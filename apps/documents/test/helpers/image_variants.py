from PIL import Image
import numpy as np
import cv2


def load_base_image():
    return Image.open(
        "test/fixtures/cedula_nueva_frontal_base.jpeg"
    )

def darken(img, factor=0.4):
    arr = np.array(img).astype(np.float32)
    arr *= factor
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def brighten(img, factor=1.8):
    arr = np.array(img).astype(np.float32)
    arr *= factor
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr)

def low_contrast(img):
    arr = np.array(img).astype(np.float32)
    mean = arr.mean()
    arr = mean + (arr - mean) * 0.3
    return Image.fromarray(arr.astype(np.uint8))

def blur(img, ksize=15):
    arr = np.array(img)
    blurred = cv2.GaussianBlur(arr, (ksize, ksize), 0)
    return Image.fromarray(blurred)

def resize_small(img, size=600):
    return img.resize((size, size))

def rotate(img, angle=5):
    arr = np.array(img)
    (h, w) = arr.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(arr, M, (w, h), borderValue=(255, 255, 255))
    return Image.fromarray(rotated)

def warp_perspective(img, max_shift=30):
    arr = np.array(img)
    h, w = arr.shape[:2]

    pts1 = np.float32([
        [0,0],
        [w-1,0],
        [w-1,h-1],
        [0,h-1]
    ])

    shift = lambda: np.random.randint(-max_shift, max_shift)
    pts2 = np.float32([
        [0+shift(),0+shift()],
        [w-1+shift(),0+shift()],
        [w-1+shift(),h-1+shift()],
        [0+shift(),h-1+shift()]
    ])

    M = cv2.getPerspectiveTransform(pts1, pts2)
    warped = cv2.warpPerspective(arr, M, (w, h), borderValue=(255,255,255))
    return Image.fromarray(warped)

def scale(img, factor=1.1):
    arr = np.array(img)
    h, w = arr.shape[:2]
    new_w, new_h = int(w*factor), int(h*factor)
    resized = cv2.resize(arr, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    return Image.fromarray(resized)

def add_gaussian_noise(img, mean=0, sigma=10):
    arr = np.array(img).astype(np.float32)
    noise = np.random.normal(mean, sigma, arr.shape)
    noisy = arr + noise
    noisy = np.clip(noisy, 0, 255).astype(np.uint8)
    return Image.fromarray(noisy)

