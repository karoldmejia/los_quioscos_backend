import pytest
from src.services.quality_validation import LowQualityError, ValidationService
from .helpers.image_variants import (load_base_image, darken, brighten, blur, low_contrast, resize_small)


def test_valid_image_passes():
    service = ValidationService()
    img = load_base_image()

    assert service.quality_validation([img]) is True


def test_image_too_small():
    service = ValidationService()
    img = resize_small(load_base_image())

    with pytest.raises(LowQualityError):
        service.quality_validation([img])


def test_image_too_dark():
    service = ValidationService()
    img = darken(load_base_image())

    with pytest.raises(LowQualityError):
        service.quality_validation([img])


def test_image_too_bright():
    service = ValidationService()
    img = brighten(load_base_image())

    with pytest.raises(LowQualityError):
        service.quality_validation([img])


def test_low_contrast():
    service = ValidationService()
    img = low_contrast(load_base_image())

    with pytest.raises(LowQualityError):
        service.quality_validation([img])


def test_low_sharpness():
    service = ValidationService()
    img = blur(load_base_image())

    with pytest.raises(LowQualityError):
        service.quality_validation([img])


def test_multiple_images_one_invalid():
    service = ValidationService()
    base = load_base_image()
    bad = blur(base)

    with pytest.raises(LowQualityError):
        service.quality_validation([base, bad])
