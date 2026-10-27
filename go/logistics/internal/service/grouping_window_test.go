package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/karoldmejia/los_quioscos_backend/go/logistics/internal/model"
)

// --- Mocks ---

type mockGroupingWindowRepository struct {
	upsertWindow *model.GroupingWindow
	upsertErr    error

	getWindow *model.GroupingWindow
	getErr    error

	candidates    []model.GroupingWindow
	candidatesErr error

	addErr        error
	addCalled     bool
	addedWindow   *model.GroupingWindow
	addedDelivery *model.DeliveryOrder
	addCallCount  int

	closeWindowsResult []model.GroupingWindow
	closeWindowsErr    error
	closeWindowsCalled bool
}

func (m *mockGroupingWindowRepository) CloseActiveWindows(ctx context.Context) ([]model.GroupingWindow, error) {
	m.closeWindowsCalled = true
	return m.closeWindowsResult, m.closeWindowsErr
}

func (m *mockGroupingWindowRepository) Upsert(ctx context.Context, window *model.GroupingWindow) (*model.GroupingWindow, error) {
	if m.upsertErr != nil {
		return nil, m.upsertErr
	}
	if m.upsertWindow != nil {
		return m.upsertWindow, nil
	}
	// Por defecto, asignar un ID si no viene
	if window.ID == uuid.Nil {
		window.ID = uuid.New()
	}
	return window, nil
}

func (m *mockGroupingWindowRepository) Delete(ctx context.Context, window *model.GroupingWindow) error {
	return nil
}

func (m *mockGroupingWindowRepository) Get(ctx context.Context, windowID string) (*model.GroupingWindow, error) {
	return m.getWindow, m.getErr
}

func (m *mockGroupingWindowRepository) GetCandidateWindowsForDelivery(ctx context.Context, pickupID, deliveryID string) ([]model.GroupingWindow, error) {
	return m.candidates, m.candidatesErr
}

func (m *mockGroupingWindowRepository) AddDeliveryToWindow(ctx context.Context, window *model.GroupingWindow, delivery *model.DeliveryOrder) error {
	m.addCallCount++
	m.addCalled = true
	m.addedWindow = window
	m.addedDelivery = delivery
	return m.addErr
}

type mockDeliveryOrderProvider struct {
	delivery *model.DeliveryOrder
	findErr  error

	pending      []model.DeliveryOrder
	pendingErr   error
	pendingLimit int
}

func (m *mockDeliveryOrderProvider) FindByOrderID(ctx context.Context, orderID string) (*model.DeliveryOrder, error) {
	if m.findErr != nil {
		return nil, m.findErr
	}
	for i := range m.pending {
		if m.pending[i].OrderID.String() == orderID {
			return &m.pending[i], nil
		}
	}
	return m.delivery, nil
}

func (m *mockDeliveryOrderProvider) FindPendingWithoutWindow(ctx context.Context, limit int) ([]model.DeliveryOrder, error) {
	m.pendingLimit = limit
	return m.pending, m.pendingErr
}

// --- Helpers ---

func validDelivery() *model.DeliveryOrder {
	return &model.DeliveryOrder{
		ID:                  uuid.New(),
		OrderID:             uuid.New(),
		UserID:              uuid.New(),
		KioskID:             uuid.New(),
		PickupRouteStopID:   uuid.New(),
		DeliveryRouteStopID: uuid.New(),
		DeliveryMode:        model.DeliveryModeGrouped,
		Status:              model.StatusPending,
		CreatedAt:           time.Now().Add(-1 * time.Minute),
	}
}

func validWindow() model.GroupingWindow {
	return model.GroupingWindow{
		ID:             uuid.New(),
		Status:         model.WindowStatusActive,
		MaxTimeMinutes: 60,
		MaxOrders:      10,
		OrderCount:     0,
		OpenedAt:       time.Now(),
	}
}

// --- Tests ---

func TestValidateDeliveryForWindow(t *testing.T) {
	tests := []struct {
		name    string
		modify  func(*model.DeliveryOrder)
		wantErr bool
	}{
		{
			name:    "valid delivery",
			modify:  func(d *model.DeliveryOrder) {},
			wantErr: false,
		},
		{
			name:    "not pending",
			modify:  func(d *model.DeliveryOrder) { d.Status = model.StatusCompleted },
			wantErr: true,
		},
		{
			name:    "not grouped",
			modify:  func(d *model.DeliveryOrder) { d.DeliveryMode = model.DeliveryModeIndividual },
			wantErr: true,
		},
		{
			name:    "missing pickup stop",
			modify:  func(d *model.DeliveryOrder) { d.PickupRouteStopID = uuid.Nil },
			wantErr: true,
		},
		{
			name:    "missing delivery stop",
			modify:  func(d *model.DeliveryOrder) { d.DeliveryRouteStopID = uuid.Nil },
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &GroupingWindowService{}
			delivery := validDelivery()
			tt.modify(delivery)

			err := svc.validateDeliveryForWindow(context.Background(), delivery)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateDeliveryForWindow() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestAddDeliveryToWindow(t *testing.T) {
	t.Run("adds to first candidate", func(t *testing.T) {
		delivery := validDelivery()
		window := validWindow()

		mockDelivery := &mockDeliveryOrderProvider{delivery: delivery}
		mockRepo := &mockGroupingWindowRepository{
			candidates: []model.GroupingWindow{window},
		}

		svc := NewGroupingWindowService(mockRepo, mockDelivery)

		err := svc.AddDeliveryToWindow(context.Background(), delivery.OrderID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.addCallCount != 1 {
			t.Errorf("AddDeliveryToWindow called %d times, want 1", mockRepo.addCallCount)
		}
		if mockRepo.addedWindow.ID != window.ID {
			t.Errorf("added to window %s, want %s", mockRepo.addedWindow.ID, window.ID)
		}
	})

	t.Run("tries next candidate when first fails", func(t *testing.T) {
		delivery := validDelivery()
		window1 := validWindow()
		window2 := validWindow()

		mockDelivery := &mockDeliveryOrderProvider{delivery: delivery}

		// Primer intento falla, segundo éxito
		mockRepo := &mockGroupingWindowRepository{
			candidates: []model.GroupingWindow{window1, window2},
		}
		callCount := 0
		mockRepoAdd := func(ctx context.Context, w *model.GroupingWindow, d *model.DeliveryOrder) error {
			callCount++
			if callCount == 1 {
				return errors.New("window full")
			}
			return nil
		}
		// Reemplazamos el método con un wrapper manual
		repoWithCustomAdd := &customAddMock{
			mockGroupingWindowRepository: mockRepo,
			addFunc:                      mockRepoAdd,
		}

		svc := NewGroupingWindowService(repoWithCustomAdd, mockDelivery)

		err := svc.AddDeliveryToWindow(context.Background(), delivery.OrderID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if callCount != 2 {
			t.Errorf("AddDeliveryToWindow called %d times, want 2", callCount)
		}
	})

	t.Run("creates new window when no candidates", func(t *testing.T) {
		delivery := validDelivery()

		mockDelivery := &mockDeliveryOrderProvider{delivery: delivery}
		mockRepo := &mockGroupingWindowRepository{
			candidates: []model.GroupingWindow{}, // vacío
		}

		svc := NewGroupingWindowService(mockRepo, mockDelivery)

		err := svc.AddDeliveryToWindow(context.Background(), delivery.OrderID.String())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		// Debe haber creado una ventana (Upsert) y añadido el pedido
		if mockRepo.addCallCount != 1 {
			t.Errorf("AddDeliveryToWindow called %d times, want 1", mockRepo.addCallCount)
		}
	})

	t.Run("fails on invalid delivery", func(t *testing.T) {
		delivery := validDelivery()
		delivery.Status = model.StatusCompleted

		mockDelivery := &mockDeliveryOrderProvider{delivery: delivery}
		mockRepo := &mockGroupingWindowRepository{}

		svc := NewGroupingWindowService(mockRepo, mockDelivery)

		err := svc.AddDeliveryToWindow(context.Background(), delivery.OrderID.String())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if mockRepo.addCallCount != 0 {
			t.Errorf("AddDeliveryToWindow called %d times, want 0", mockRepo.addCallCount)
		}
	})
}

// customAddMock permite inyectar una función AddDeliveryToWindow personalizada
type customAddMock struct {
	*mockGroupingWindowRepository
	addFunc func(ctx context.Context, w *model.GroupingWindow, d *model.DeliveryOrder) error
}

func (c *customAddMock) AddDeliveryToWindow(ctx context.Context, w *model.GroupingWindow, d *model.DeliveryOrder) error {
	return c.addFunc(ctx, w, d)
}

func TestCreateWindow(t *testing.T) {
	t.Run("creates window and adds delivery", func(t *testing.T) {
		delivery := validDelivery()
		mockRepo := &mockGroupingWindowRepository{}
		svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

		err := svc.CreateWindow(context.Background(), delivery)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.addCallCount != 1 {
			t.Errorf("AddDeliveryToWindow called %d times, want 1", mockRepo.addCallCount)
		}
		if mockRepo.addedDelivery.OrderID != delivery.OrderID {
			t.Errorf("added delivery %s, want %s", mockRepo.addedDelivery.OrderID, delivery.OrderID)
		}
	})

	t.Run("fails when upsert fails", func(t *testing.T) {
		mockRepo := &mockGroupingWindowRepository{upsertErr: errors.New("db down")}
		svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

		err := svc.CreateWindow(context.Background(), validDelivery())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})

	t.Run("fails when add fails", func(t *testing.T) {
		mockRepo := &mockGroupingWindowRepository{addErr: errors.New("add failed")}
		svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

		err := svc.CreateWindow(context.Background(), validDelivery())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestProcessPendingOrders(t *testing.T) {
	t.Run("processes and groups pending orders", func(t *testing.T) {
		d1 := validDelivery()
		d2 := validDelivery()
		window := validWindow()

		mockDelivery := &mockDeliveryOrderProvider{
			pending: []model.DeliveryOrder{*d1, *d2},
		}
		mockRepo := &mockGroupingWindowRepository{
			candidates: []model.GroupingWindow{window},
		}

		svc := NewGroupingWindowService(mockRepo, mockDelivery)

		err := svc.processPendingOrders(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockDelivery.pendingLimit != 100 {
			t.Errorf("limit = %d, want 100", mockDelivery.pendingLimit)
		}
		// Ambos deberían intentar agruparse
		if mockRepo.addCallCount < 1 {
			t.Errorf("AddDeliveryToWindow called %d times, want at least 1", mockRepo.addCallCount)
		}
	})

	t.Run("returns nil when no pending orders", func(t *testing.T) {
		mockDelivery := &mockDeliveryOrderProvider{pending: []model.DeliveryOrder{}}
		mockRepo := &mockGroupingWindowRepository{}

		svc := NewGroupingWindowService(mockRepo, mockDelivery)

		err := svc.processPendingOrders(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if mockRepo.addCallCount != 0 {
			t.Errorf("AddDeliveryToWindow called %d times, want 0", mockRepo.addCallCount)
		}
	})

	t.Run("propagates error from FindPendingWithoutWindow", func(t *testing.T) {
		mockDelivery := &mockDeliveryOrderProvider{pendingErr: errors.New("db down")}
		mockRepo := &mockGroupingWindowRepository{}

		svc := NewGroupingWindowService(mockRepo, mockDelivery)

		err := svc.processPendingOrders(context.Background())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestCloseActiveWindows(t *testing.T) {
	t.Run("closes windows and estimates routes", func(t *testing.T) {
		window1 := validWindow()
		window2 := validWindow()

		mockRepo := &mockGroupingWindowRepository{
			closeWindowsResult: []model.GroupingWindow{window1, window2},
		}
		svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

		err := svc.closeActiveWindows(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !mockRepo.closeWindowsCalled {
			t.Error("expected CloseActiveWindows to be called")
		}
	})

	t.Run("returns nil when no windows to close", func(t *testing.T) {
		mockRepo := &mockGroupingWindowRepository{
			closeWindowsResult: []model.GroupingWindow{},
		}
		svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

		err := svc.closeActiveWindows(context.Background())
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})

	t.Run("propagates error from CloseActiveWindows", func(t *testing.T) {
		mockRepo := &mockGroupingWindowRepository{
			closeWindowsErr: errors.New("db down"),
		}
		svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

		err := svc.closeActiveWindows(context.Background())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
	})
}

func TestStartPendingOrdersJob_StopsOnContextCancel(t *testing.T) {
	mockRepo := &mockGroupingWindowRepository{}
	mockDelivery := &mockDeliveryOrderProvider{pending: []model.DeliveryOrder{}}
	svc := NewGroupingWindowService(mockRepo, mockDelivery)

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		StartPendingOrdersJob(ctx, svc, 10*time.Millisecond)
		close(done)
	}()

	// Esperar un poco para que el ticker se dispare al menos una vez
	time.Sleep(30 * time.Millisecond)
	cancel()

	select {
	case <-done:
		// El job terminó correctamente
	case <-time.After(1 * time.Second):
		t.Fatal("job did not stop after context cancellation")
	}
}

func TestCheckActiveWindowsJob_StopsOnContextCancel(t *testing.T) {
	mockRepo := &mockGroupingWindowRepository{}
	svc := NewGroupingWindowService(mockRepo, &mockDeliveryOrderProvider{})

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		CheckActiveWindowsJob(ctx, svc, 10*time.Millisecond)
		close(done)
	}()

	time.Sleep(30 * time.Millisecond)
	cancel()

	select {
	case <-done:
		// El job terminó correctamente
	case <-time.After(1 * time.Second):
		t.Fatal("job did not stop after context cancellation")
	}
}
