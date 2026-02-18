import re
from typing import Any, Dict, List, Tuple, Optional
import cv2
import pytesseract
import numpy as np


class PostAssignmentProcessor:
    """
    Processes assigned groups after semantic validation.
    Determines which fields require OCR and processes them,
    adding OCR results directly to the existing structure.
    """
    
    def __init__(self):
        # Keywords that indicate fields where OCR does not apply
        self.non_ocr_keywords = ["photo", "codigo", "firma", "escudo", "huella", "logo", 
                                "microphoto", "qr", "photo_", "mariposa", "micro"]
    
    def needs_ocr(self, field_name: str) -> bool:
        """
        Determines if a field needs OCR based on its name
        """
        field_lower = field_name.lower()
        
        # If contains a non-OCR keyword, returns False
        for keyword in self.non_ocr_keywords:
            if keyword in field_lower:
                return False
        
        # If does not contain any, we assume it needs OCR
        return True
    
    def extract_text_from_groups(self, img: np.ndarray, 
                                assigned_groups: List[Dict],
                                img_shape: Tuple[int, int]) -> str:
        """
        Extract text from assigned groups
        """
        if not assigned_groups:
            return ""
        
        # Sort groups left to right, top to bottom
        sorted_groups = sorted(
            assigned_groups,
            key=lambda g: (g["norm_bbox"][1], g["norm_bbox"][0])  # y, x
        )
        
        all_texts = []
        
        for group in sorted_groups:
            # Convert normalized bbox to pixel coordinates
            norm_bbox = group["norm_bbox"]
            h, w = img_shape[:2]
            
            x1 = int(norm_bbox[0] * w)
            y1 = int(norm_bbox[1] * h)
            x2 = int(norm_bbox[2] * w)
            y2 = int(norm_bbox[3] * h)
            
            # Ensure coordinates are within image bounds
            x1 = max(0, min(x1, w-1))
            y1 = max(0, min(y1, h-1))
            x2 = max(0, min(x2, w))
            y2 = max(0, min(y2, h))
            
            if x2 > x1 and y2 > y1:
                region_img = img[y1:y2, x1:x2]
                
                # Verify region is not empty
                if region_img.size > 0:
                    try:
                        # Preprocessing for OCR
                        gray = cv2.cvtColor(region_img, cv2.COLOR_BGR2GRAY)
                        _, thresh = cv2.threshold(
                            gray, 0, 255,
                            cv2.THRESH_BINARY + cv2.THRESH_OTSU
                        )
                        
                        # Apply OCR with appropriate configuration
                        text = pytesseract.image_to_string(
                            thresh,
                            config="--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/.-:,"
                        ).strip()
                        
                        if text:
                            all_texts.append(text)
                    except Exception as e:
                        print(f"Error in OCR for region {norm_bbox}: {e}")
                        continue
        
        return " ".join(all_texts).strip()
    
    def add_ocr_to_page_results(self, 
                            original_images: List[np.ndarray],
                            page_results: List[Dict]) -> List[Dict]:
        """
        Add OCR text directly to page results structure.
        
        Args:
            original_images: List of original images (one per page)
            page_results: Results from _process_page for each page
            
        Returns:
            Modified page_results with OCR text added
        """
        modified_results = []
        
        for page_idx, page_result in enumerate(page_results):
            if page_idx >= len(original_images):
                modified_results.append(page_result)
                continue
                
            img = original_images[page_idx]
            img_shape = img.shape
            
            # Get assignments
            assignments = page_result.get("assignments", {})
            
            # Process each field
            for field_name, assigned_groups in assignments.items():
                # Skip if field doesn't need OCR
                if not self.needs_ocr(field_name):
                    continue
                
                # Extract text from groups
                text = self.extract_text_from_groups(img, assigned_groups, img_shape)
                
                # Add text directly to assignated_groups
                if "assignated_groups" in page_result and field_name in page_result["assignated_groups"]:
                    current_data = page_result["assignated_groups"][field_name]
                    
                    if isinstance(current_data, tuple):
                        #if its just a tuple bbox, we turn it into a dict
                        page_result["assignated_groups"][field_name] = {
                            "bbox": current_data,
                            "text": text
                        }
                    elif isinstance(current_data, dict):
                        # if it its already a dict
                        current_data["text"] = text
                    # if already has text, it gest overrided
            
            modified_results.append(page_result)
        
        return modified_results
    
    def enrich_semantic_results(self, semantic_results: Dict[str, Any], original_images: List[np.ndarray]) -> Dict[str, Any]:
        """
        Enrich semantic results by adding OCR text directly to the structure.
        
        Args:
            semantic_results: Results from SemanticAsignation.process_document()
            original_images: Original images
        
        Returns:
            Enriched results with OCR text integrated
        """
        # Create a copy to avoid modifying original
        enriched_results = semantic_results.copy()
        
        # Get page results
        page_results = enriched_results.get("pages", [])
        
        if not page_results:
            return enriched_results
        
        # Add OCR to page results
        enriched_page_results = self.add_ocr_to_page_results(original_images, page_results)
        enriched_results["pages"] = enriched_page_results

        return enriched_results

    def get_textual_data(self, enriched_results: Dict[str, Any]) -> Dict[str, str]:
        """
        Extract textual data from enriched results
        
        Args:
            enriched_results: Results enriched with OCR
            
        Returns:
            Dictionary {field: text} for fields that received OCR
        """
        textual_data = {}
        
        # get results per page
        page_results = enriched_results.get("pages", [])
        
        for page_idx, page_result in enumerate(page_results):
            # get assignated groups from this page
            assignated_groups = page_result.get("assignated_groups", {})
            
            for field_name, data in assignated_groups.items():
                # if data is a dict with "text" field (it has OCR)
                if isinstance(data, dict) and "text" in data:
                    text = data.get("text", "")
                    if text:  # just if there are text
                        # create unique key
                        field_key = f"page{page_idx}_{field_name}" if len(page_results) > 1 else field_name
                        textual_data[field_key] = text
        return textual_data
    
    def validate_textual_data(self, textual_data: Dict[str, str]) -> Dict[str, Dict]:
        """
        Soft textual validation using scores
        """

        results = {}
        final_scores = []

        for field_key, text in textual_data.items():
            field_name = self._extract_field_name(field_key).lower()
            text = text.strip()

            scores = {}
            issues = []

            if not text:
                results[field_key] = {
                    "text": text,
                    "scores": {
                        "format": 0.0,
                        "length": 0.0,
                    },
                    "final_score": 0.0,
                    "issues": ["Empty text"]
                }
                final_scores.append(0.0)
                continue

            # format score
            if "fecha" in field_name:
                scores["format"] = self._date_score(text)
            elif any(k in field_name for k in ["documento", "id", "nuip", "cedula", "dni"]):
                scores["format"] = self._id_score(text)
            elif any(k in field_name for k in ["nombre", "apellido"]):
                scores["format"] = self._name_score(text)
            else:
                scores["format"] = 1.0

            if scores["format"] < 0.5:
                issues.append("Weak format match")

            # length score
            scores["length"] = self._length_score(text, field_name)

            if scores["length"] < 0.5:
                issues.append("Suspicious length")

            # final field score
            final_score = 0.8 * scores["format"] + 0.2 * scores["length"]
            final_scores.append(final_score)

            results[field_key] = {
                "text": text,
                "scores": scores,
                "final_score": final_score,
                "issues": issues
            }

        global_score = sum(final_scores) / len(final_scores) if final_scores else 0.0
        return global_score

    
    def _extract_field_name(self, field_key: str) -> str:
        """Extract field name without page prefix"""
        if "_" in field_key and field_key.startswith("page"):
            return field_key.split("_", 1)[1]
        return field_key
    
    def _date_score(self, text: str) -> float:
        patterns = [
            r'^\d{2}/\d{2}/\d{4}$',
            r'^\d{2}-\d{2}-\d{4}$',
            r'^\d{4}-\d{2}-\d{2}$',
        ]

        for p in patterns:
            if re.match(p, text):
                return 1.0

        # it has it partially
        if re.search(r'\d', text):
            return 0.5

        return 0.0
        
    def _id_score(self, text: str) -> float:
        clean = re.sub(r'[^\d]', '', text)

        if not clean:
            return 0.0

        length = len(clean)

        if 7 <= length <= 12:
            return 1.0
        elif 5 <= length <= 20:
            return 0.6
        else:
            return 0.3

    def _name_score(self, text: str) -> float:
        allowed = re.findall(r'[A-Za-zÁÉÍÓÚáéíóúÑñÜü]', text)
        ratio = len(allowed) / max(1, len(text))

        if ratio > 0.9 and len(text.replace(" ", "")) >= 3:
            return 1.0
        elif ratio > 0.7:
            return 0.6
        else:
            return 0.2

    def _length_score(self, text: str, field_name: str) -> float:
        l = len(text)

        if "fecha" in field_name:
            ideal = (8, 12)
        elif any(k in field_name for k in ["documento", "id", "nuip"]):
            ideal = (5, 20)
        elif any(k in field_name for k in ["nombre", "apellido"]):
            ideal = (2, 50)
        else:
            ideal = (1, 100)

        if ideal[0] <= l <= ideal[1]:
            return 1.0

        # Soft penalty
        dist = min(abs(l - ideal[0]), abs(l - ideal[1]))
        return max(0.0, 1.0 - dist / max(ideal))
