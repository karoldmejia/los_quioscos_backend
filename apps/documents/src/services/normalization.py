import cv2
import numpy as np

class NormalizationError(Exception):
    pass

def pil_to_cv(img_pil):
    img = np.array(img_pil)
    return cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

def detect_edges(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 75, 200)
    return edges

def find_contours(edges):
    contours, _ = cv2.findContours(
        edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )
    return contours

def find_document_quad(contours, img_shape):
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    img_area = img_shape[0] * img_shape[1]

    for i, c in enumerate(contours[:10]):
        area = cv2.contourArea(c)

        if area < img_area * 0.2:
            continue

        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)

        if len(approx) == 4:
            return approx.astype("float32")

        rect = cv2.minAreaRect(c)
        box = cv2.boxPoints(rect)
        return box.astype("float32")
    return None

def order_points(pts):
    pts = pts.reshape(4, 2)
    rect = np.zeros((4, 2), dtype="float32")

    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]

    return rect

def warp_document(img, contour):
    rect = order_points(contour)

    (tl, tr, br, bl) = rect

    widthA = np.linalg.norm(br - bl)
    widthB = np.linalg.norm(tr - tl)
    maxWidth = int(max(widthA, widthB))

    heightA = np.linalg.norm(tr - br)
    heightB = np.linalg.norm(tl - bl)
    maxHeight = int(max(heightA, heightB))

    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(img, M, (maxWidth, maxHeight))

    return warped

# Main function
def normalize_document(pil_img):
    img = pil_to_cv(pil_img)
    edges = detect_edges(img)
    contours = find_contours(edges)
    quad = find_document_quad(contours, img.shape)

    if quad is None:
        return img

    warped = warp_document(img, quad)
    return warped
