import pytest
from PIL import Image
from src.services.normalization import normalize_document, NormalizationError
from .helpers.image_variants import (
    load_base_image, darken, brighten, low_contrast, blur, resize_small,
    rotate, warp_perspective, scale, add_gaussian_noise
)

@pytest.fixture
def base_image():
    return load_base_image()

def test_normalization_base(base_image):
    """Test with original image"""
    normalized = normalize_document(base_image)
    assert isinstance(normalized, (Image.Image, type(normalized)))
    assert normalized.shape[0] > 0
    assert normalized.shape[1] > 0

@pytest.mark.parametrize("variant_func", [
    darken,
    brighten,
    low_contrast,
    blur,
    resize_small
])
def test_normalization_quality_variants(base_image, variant_func):
    img = variant_func(base_image)
    normalized = normalize_document(img)
    assert isinstance(normalized, (Image.Image, type(normalized)))
    assert normalized.shape[0] > 0
    assert normalized.shape[1] > 0


@pytest.mark.parametrize("variant_func", [
    rotate,
    warp_perspective,
    scale
])
def test_normalization_geometric_variants(base_image, variant_func):
    img = variant_func(base_image)
    normalized = normalize_document(img)
    assert isinstance(normalized, (Image.Image, type(normalized)))
    assert normalized.shape[0] > 0
    assert normalized.shape[1] > 0


def test_normalization_noise(base_image):
    img = add_gaussian_noise(base_image)
    normalized = normalize_document(img)
    assert isinstance(normalized, (Image.Image, type(normalized)))
    assert normalized.shape[0] > 0
    assert normalized.shape[1] > 0


def test_normalization_no_document():
    """
    Create a blank image without a document to fail normalization
    """
    img = Image.new("RGB", (1000, 1000), color=(255, 255, 255))
    with pytest.raises(NormalizationError):
        normalize_document(img)
