from datetime import datetime
import os
from typing import Optional
import uuid
import time
from io import BytesIO
from PIL import Image
import numpy as np
from pdf2image import convert_from_bytes
import pytesseract
from PyPDF2 import PdfReader
import hashlib

from .services.biometric_processor import BiometricError, BiometricProcessor
from .services.post_asignment_processor import PostAssignmentProcessor
from .services.semantic_asignation import SemanticAsignation
from .services.text_detection import TextDetector
from .services.structural_segmenter import StructuralSegmenter
from .services.normalization import NormalizationError, normalize_document
from .document_repo import DocumentsRepository
from .models.document import Document
from .models.document_type import DocumentType
from .services.quality_validation import LowQualityError, ValidationService


class TechnicalValidationError(Exception):
    pass

class DocumentService:

    MAX_FILE_SIZE = 7 * 1024 * 1024   # 7MB
    MAX_FILES = 3

    def __init__(self):
        self.repo = DocumentsRepository()
        self.validator = ValidationService()
        self.segmenter = StructuralSegmenter()
        self.text_detector = TextDetector()
        self.post_assignment_processor = PostAssignmentProcessor()
        self.structure_validator = SemanticAsignation()
        self.biometric = BiometricProcessor()

    async def process_document(self, user_id, doc_type_id, files_bytes: list[bytes], selfie_bytes: Optional[bytes] = None):

        try:
            file_hash = self.hash_files(files_bytes)
            file_images = self.to_images(files_bytes)
            self.validator.quality_validation(file_images)

            normalized_images = [
                normalize_document(img)
                for img in file_images
            ]

            # structural segmentation
            structural_regions = self.segmenter.process_documents(normalized_images)
            
            # prepare data for semantic assignation
            all_groups = []
            all_img_shapes = []
            
            for page_idx, (img, regions) in enumerate(zip(normalized_images, structural_regions)):
                # group each page regions
                groups = self.segmenter.group_regions(regions)
                # add to semantic assignation lists
                all_groups.append(groups)
                all_img_shapes.append(img.shape)  
            
            # semantic validation and assignation for all pages
            structural_results = self.structure_validator.process_document(
                document_id=doc_type_id,
                all_groups=all_groups,
                all_img_shapes=all_img_shapes,
                overlap_threshold=0.3
            )

            # after ocr processing
            enriched_results = self.post_assignment_processor.enrich_semantic_results(
                structural_results,
                normalized_images
            )
            # extract text
            textual_data = self.post_assignment_processor.get_textual_data(enriched_results)
            
            # text logic validation
            logic_validation_result = self.post_assignment_processor.validate_textual_data(textual_data)

            if selfie_bytes is not None:
                # active biometric pipeline
                doc_face = await self.biometric.get_face_from_full_image(normalized_images)
                biometric_result = await self.biometric.verify_biometric(doc_face, selfie_bytes)

            final_score = self.calculate_final_document_score(
                structural_results=structural_results,
                logic_score=logic_validation_result,
                biometric_score=biometric_result if selfie_bytes else None
            )

            is_valid = True if final_score >= 0.55 else False
            print("final score: "+ str(final_score))

        except BiometricError as e:
            return {
                "success": False,
                "error_code": "BIOMETRIC_ERROR",
                "error_message": str(e)
            }
        
        except TechnicalValidationError as e:
            return {
                "success": False,
                "error_code": "TECHNICAL_VALIDATION_ERROR",
                "error_message": str(e)
            }
        
        except LowQualityError as e:
            return {
                "success": False,
                "error_code": "LOW_QUALITY_ERROR",
                "error_message": str(e)
            }
        
        except NormalizationError as e:
            return {
                "success": False,
                "error_code": "NORMALIZATION_ERROR",
                "error_message": str(e)
            }

        document = Document(
            id=None,
            user_id=user_id,
            doc_type_id=doc_type_id,
            metadata=enriched_results,
            file_hash=file_hash,
            is_valid=is_valid,
            validated_at=datetime.utcnow(),
        )

        saved_doc = await self.repo.create(document)

        return {
            "success": True,
            "is_valid": is_valid,
        }

    
    # helper methods
    # technical initial validation

    def detect_file_type(self, file_bytes: bytes) -> str:
        header = file_bytes[:4]

        if header.startswith(b'\xff\xd8'):
            return "jpeg"

        if header.startswith(b'\x89PNG'):
            return "png"

        if header.startswith(b'%PDF'):
            return "pdf"

        return "unknown"

    def validate_single_file(self, file_bytes: bytes):

        if len(file_bytes) > self.MAX_FILE_SIZE:
            raise TechnicalValidationError("File exceeds 7MB limit")

        file_type = self.detect_file_type(file_bytes)

        if file_type not in ("jpeg", "png", "pdf"):
            raise TechnicalValidationError("File must be png, jpeg or pdf")

        if file_type == "pdf":
            reader = PdfReader(BytesIO(file_bytes))
            if reader.is_encrypted:
                raise TechnicalValidationError("PDF is password protected")

        return file_type


    def to_images_from_single_file(self, file_bytes: bytes):
        """
        Turns a single file on a list of images
        """

        file_type = self.detect_file_type(file_bytes)

        if file_type in ("jpeg", "png"):
            img = Image.open(BytesIO(file_bytes))
            return [img]

        elif file_type == "pdf":
            return convert_from_bytes(file_bytes)

        else:
            raise TechnicalValidationError("Unsupported format. Needs to be .png, .jpeg or .pdf")


    def to_images(self, files_bytes):
        """
        Accepts:
            - bytes
            - list[bytes]

        Returns:
            - list[PIL.Image]
        """

        if isinstance(files_bytes, bytes):
            files_bytes = [files_bytes]

        if not isinstance(files_bytes, list):
            raise ValueError("files_bytes must be bytes or list[bytes]")

        if len(files_bytes) > self.MAX_FILES:
            raise TechnicalValidationError("Max 3 files allowed per document")

        all_images = []

        for file_bytes in files_bytes:

            if not isinstance(file_bytes, bytes):
                raise ValueError("All elements must be bytes")

            file_type = self.validate_single_file(file_bytes)

            if file_type in ("jpeg", "png"):
                img = Image.open(BytesIO(file_bytes))
                all_images.append(img)

            elif file_type == "pdf":
                pdf_images = convert_from_bytes(file_bytes)
                all_images.extend(pdf_images)

        return all_images

    def calculate_final_document_score(self, structural_results: dict, logic_score: float, biometric_score: float | None = None) -> float:
        """
        Calculate final document's score (between 0 and 1)

        rules:
        - Structural has the most importance
        - Biometric its optional (it depends if the document includes the face)
        - If the score its higher than 0.6, the document its valid
        """
        combined = structural_results.get("combined_validation", {})
        structural_score = float(
            np.clip(
                combined.get("final_score", 0.0),
                0.0,
                1.0
            )
        )
        # make sure the number its valid
        print("structural score: "+ str(structural_score))
        print("logic score: "+ str(logic_score))

        if biometric_score is not None:
            print("biometric score: "+ str(biometric_score))

            final_score = (
                0.5 * structural_score +
                0.3 * logic_score +
                0.2 * biometric_score
            )
        else:
            # redistribute weights if there is not biometric score
            final_score = (
                0.65 * structural_score +
                0.35 * logic_score
            )

        return float(np.clip(final_score, 0.0, 1.0))

    def hash_files(self, files_bytes: list[bytes]) -> str:
        hasher = hashlib.sha256()

        for file in files_bytes:
            hasher.update(file)

        return hasher.hexdigest()
