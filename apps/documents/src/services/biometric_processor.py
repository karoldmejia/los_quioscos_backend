from pathlib import Path
import numpy as np
import cv2
from typing import Dict, List, Tuple, Optional, Any, Tuple
import asyncio
from dataclasses import dataclass
from enum import Enum

class BiometricError(Exception):
    pass

@dataclass
class FaceDetection:
    """Face detection results"""
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    embedding: np.ndarray


class BiometricProcessor:
    """
    Biometric processor for faces comparison
    """
    
    def __init__(self):
        
        self.face_model = self._load_face_model()
    
    def _load_face_model(self):
        """Load the complete facial analysis model (detection, alignment, and embedding)"""
        import insightface

        model = insightface.app.FaceAnalysis(
            name="buffalo_l"  # RetinaFace + ArcFace
        )
        model.prepare(ctx_id=0)  # use gpu if available, if not cpu

        return model
    
    async def get_face_from_full_image(self, original_images: List[np.ndarray]) -> Optional[np.ndarray]:
        """
        Try to detect face directly from full document image (fallback).
        """        
        for page_idx, img in enumerate(original_images):
            
            faces = self.face_model.get(img)
            
            if faces:
                # select main face
                main_face = self._select_main_face(faces, img.shape)
                if main_face:
                    x1, y1, x2, y2 = map(int, main_face.bbox)
                    
                    # add margin
                    margin_x = int((x2 - x1) * 0.2)
                    margin_y = int((y2 - y1) * 0.2)
                    
                    x1 = max(0, x1 - margin_x)
                    y1 = max(0, y1 - margin_y)
                    x2 = min(img.shape[1], x2 + margin_x)
                    y2 = min(img.shape[0], y2 + margin_y)
                    
                    face_region = img[y1:y2, x1:x2]
                                        
                    return face_region
    
    def _extract_bbox(self, data: Any) -> Optional[Tuple]:
        """
        Extract bbox from various data structures.
        """
        if isinstance(data, dict):
            bbox = data.get("bbox")
            if isinstance(bbox, tuple) and len(bbox) == 4:
                return bbox
            elif isinstance(bbox, dict) and all(k in bbox for k in ["x1", "y1", "x2", "y2"]):
                return (bbox["x1"], bbox["y1"], bbox["x2"], bbox["y2"])
        elif isinstance(data, tuple) and len(data) == 4:
            return data
        
        return None
    
    async def verify_biometric(self, doc_face_img: np.ndarray, selfie_bytes: bytes) -> float:
        """
        Main function for biometric verification
        """
        try:
            # Decode selfie
            selfie_img = await self._bytes_to_image_async(selfie_bytes)
            if selfie_img is None:
                raise BiometricError("Selfie cannot be decoded")

            if doc_face_img is None:
                raise BiometricError("Document face was not found")

            # Process selfie
            selfie_result = await self._process_face(selfie_img, "selfie")
            if not selfie_result:
                raise BiometricError("Selfie face was not detected")

            # Process document face
            doc_face_img = self.pad_face_image(doc_face_img)

            doc_face_result = await self._process_face(
                doc_face_img, "document"
            )
            if not doc_face_result:
                raise BiometricError("Document face was not detected")

            # Compare faces
            similarity_score = self._compare_faces_adjusted_for_documents(
                doc_face_result,
                selfie_result
            )

            return similarity_score

        except BiometricError:
            raise

        except Exception as e:
            raise BiometricError("Face processing failed") 

    
    async def _process_face(self, image: np.ndarray, source: str) -> Optional[FaceDetection]:
        """
        Process a face using insight face (with detection, alineation and embedding)

        Args:
            image: Image (np.ndarray) that contains a face
            source: "document" or "selfie"

        Returns:
            Face detection if its detected
        """
        try:
            # process with insightface
            faces = self.face_model.get(image)
            
            if not faces:
                return None
                        
            for i, face in enumerate(faces):                
                if hasattr(face, 'normed_embedding'):
                    emb = face.normed_embedding
            
            face = self._select_main_face(faces, image.shape)
            if face is None:
                return None
            
            return FaceDetection(
                bbox=tuple(map(int, face.bbox)),
                confidence=float(face.det_score),
                embedding=face.normed_embedding
            )
            
        except Exception as e:
            raise BiometricError(
                f"Face processing failed for source '{source}'"
            )


    def _select_main_face(self, faces: list, image_shape: tuple):
        """
        Select main face between multiple detections, using
        size, centrality and detectors confidence
        """
        if not faces:
            return None

        h, w = image_shape[:2]
        img_cx, img_cy = w / 2, h / 2

        best_face = None
        best_score = -1.0

        for face in faces:
            x1, y1, x2, y2 = face.bbox
            face_w = x2 - x1
            face_h = y2 - y1

            # 1. relative faces size
            size_score = (face_w * face_h) / (w * h)

            # 2. distance to image's center
            face_cx = (x1 + x2) / 2
            face_cy = (y1 + y2) / 2

            dist = np.sqrt((face_cx - img_cx) ** 2 + (face_cy - img_cy) ** 2)
            max_dist = np.sqrt(img_cx ** 2 + img_cy ** 2)

            center_score = 1.0 - (dist / max_dist)

            # 3. detector's confidence
            confidence_score = float(face.det_score)

            # final weighted score
            total_score = (
                0.4 * size_score +
                0.4 * center_score +
                0.2 * confidence_score
            )

            if total_score > best_score:
                best_score = total_score
                best_face = face

        return best_face

    def _compare_faces_adjusted_for_documents(self, face1: FaceDetection, face2: FaceDetection) -> float:
        """
        Adjusted comparison specifically for document vs selfie scenarios.
        """        
        e1 = face1.embedding
        e2 = face2.embedding
        
        # Calculate cosine similarity
        cos_sim = np.dot(e1, e2)
        
        # FOR DOCUMENTS: Thresholds should be lower because:
        # 1. Document photos are of lower quality.
        # 2. Lighting is different (flash vs. natural light).
        # 3. Facial expressions are neutral vs. selfies.
        
        # Adjusted thresholds for documents:
        if cos_sim > 0.5:
            score = 0.7 + 0.3 * (cos_sim - 0.5) * 2
        elif cos_sim > 0.3:
            score = 0.4 + 0.3 * (cos_sim - 0.3) / 0.2
        elif cos_sim > 0.1:
            score = 0.1 + 0.3 * (cos_sim - 0.1) / 0.2
        else:
            score = cos_sim * 1.0
                
        # adjust with confidences quality
        conf1 = face1.confidence
        conf2 = face2.confidence
        
        confidence_factor = (conf1 * 0.4 + conf2 * 0.6)
        
        final_score = 0.8 * score + 0.2 * confidence_factor
        final_score = min(1.0, max(0.0, final_score))
                
        return final_score
    
    async def _bytes_to_image_async(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Converts bytes to images asynchronously"""
        try:
            loop = asyncio.get_event_loop()
            image = await loop.run_in_executor(
                None,
                self._bytes_to_image_sync,
                image_bytes
            )
            return image
        
        except Exception as e:
            raise BiometricError(
                f"Error converting bytes to image: '{e}'"
            )
    
    def _bytes_to_image_sync(self, image_bytes: bytes) -> Optional[np.ndarray]:
        """Synchronous version of bytes-to-image conversion"""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        max_size = 1024
        if img is not None:
            h, w = img.shape[:2]
            if max(h, w) > max_size:
                scale = max_size / max(h, w)
                new_w, new_h = int(w * scale), int(h * scale)
                img = cv2.resize(img, (new_w, new_h))
        
        return img
    
    def pad_face_image(self, img, pad_ratio=0.6):
        h, w = img.shape[:2]
        pad_h = int(h * pad_ratio)
        pad_w = int(w * pad_ratio)

        return cv2.copyMakeBorder(
            img,
            pad_h, pad_h,
            pad_w, pad_w,
            borderType=cv2.BORDER_REPLICATE
        )