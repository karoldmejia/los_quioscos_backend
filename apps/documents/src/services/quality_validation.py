from typing import List
from PIL import Image
import numpy as np
import cv2
from io import BytesIO


class LowQualityError(Exception):
    pass


class ValidationService:

    MIN_SIZE_PX = 500
    MIN_FILE_KB = 50
    BRIGHTNESS_RANGE = (110, 250)
    CONTRAST_RANGE = (30, 70)
    MIN_SHARPNESS = 100


    def quality_validation(self, file_images: List[Image.Image]):

        for idx, img in enumerate(file_images):

            # resolution
            width, height = img.size

            if width < self.MIN_SIZE_PX or height < self.MIN_SIZE_PX:
                raise LowQualityError(f"Image {idx} too small. "
                                      f"Needs at least {self.MIN_SIZE_PX}px")

            # gray scale
            gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)

            # brightness
            brightness = gray.mean()

            if brightness < self.BRIGHTNESS_RANGE[0]:
                raise LowQualityError(
                    f"The image is too dark and cannot be properly processed"
                )

            elif brightness > self.BRIGHTNESS_RANGE[1]:
                raise LowQualityError(
                    f"The image is too bright and cannot be properly processed"
                )

            # contrast
            contrast = gray.std()
            if contrast < self.CONTRAST_RANGE[0]:
                raise LowQualityError(
                    f"The image has too low contrast and text cannot be recognized"
                )

            # sharpness
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            sharpness = laplacian.var()

            if sharpness < self.MIN_SHARPNESS:
                raise LowQualityError(
                    f"The image is not sharp enough"
                )

        return True
