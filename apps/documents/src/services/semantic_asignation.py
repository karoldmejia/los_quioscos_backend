import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


class SemanticAsignation:
    
    def __init__(self):
        self.layouts = self._load_layouts()

    def _load_layouts(self):
        """Load layouts keeping original structure"""
        layouts = {}
        base = Path("src/layouts")

        for file in base.glob("*.json"):
            try:
                parts = file.stem.split("_", 1)
                doc_type_id = int(parts[0])          # 1
                doc_key = parts[1] if len(parts) > 1 else str(doc_type_id)

                layout_data = json.load(open(file))

                templates_by_page = []
                for template_info in layout_data.get("templates", []):
                    templates_by_page.append({
                        "side": template_info.get(
                            "side",
                            f"page_{len(templates_by_page)}"
                        ),
                        "template": template_info["template"]
                    })

                layouts[doc_type_id] = {
                    "document_key": doc_key,
                    "document_type": layout_data.get("document_type"),
                    "document_type_id": doc_type_id,
                    "version": layout_data.get("version"),
                    "templates": templates_by_page
                }

            except Exception as e:
                print(f"Error cargando layout {file}: {e}")
                continue

        return layouts

    def normalize_bbox(self, bbox, img_shape):
        """
        Converts an absolute bounding box (pixel coordinates)
        into normalized coordinates relative to image size.
        """
        h, w = img_shape[:2]
        x1, y1, x2, y2 = bbox

        return {
            "x1": x1 / w,
            "y1": y1 / h,
            "x2": x2 / w,
            "y2": y2 / h,
            "width": (x2 - x1) / w,
            "height": (y2 - y1) / h
        }

    def normalize_groups(self, groups, img_shape):
        """
        Normalizes bounding boxes for a list of detected groups,
        making them resolution-independent.
        """
        normalized = []

        for g in groups:
            norm_bbox = self.normalize_bbox(g["bbox"], img_shape)
            normalized.append({
                **g,
                "norm_bbox": (
                    norm_bbox["x1"],
                    norm_bbox["y1"],
                    norm_bbox["x2"],
                    norm_bbox["y2"],
                )
            })

        return normalized

    def merge_bboxes(self, bboxes):
        """
        Computes the minimal bounding box that encloses
        a list of bounding boxes.
        """
        x1 = min(b[0] for b in bboxes)
        y1 = min(b[1] for b in bboxes)
        x2 = max(b[2] for b in bboxes)
        y2 = max(b[3] for b in bboxes)
        return (x1, y1, x2, y2)
    
    def overlap_ratio(self, bbox_input, bbox_layout):
        """
        Computes the overlap ratio between two bounding boxes
        as intersection area over input box area.
        """
        ix1 = max(bbox_input[0], bbox_layout[0])
        iy1 = max(bbox_input[1], bbox_layout[1])
        ix2 = min(bbox_input[2], bbox_layout[2])
        iy2 = min(bbox_input[3], bbox_layout[3])

        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0

        inter_area = (ix2 - ix1) * (iy2 - iy1)
        input_area = (
            (bbox_input[2] - bbox_input[0]) *
            (bbox_input[3] - bbox_input[1])
        )

        return inter_area / input_area if input_area > 0 else 0.0

    def assign_groups_to_layout(self, groups, img_shape, layout_template, overlap_threshold=0.3):
        """
        Assigns detected groups to semantic layout fields
        based on geometric overlap.
        """
        normalized_groups = self.normalize_groups(groups, img_shape)

        assignments = {}

        for field, layout_bbox in layout_template.items():
            layout_box = (
                layout_bbox["x1"],
                layout_bbox["y1"],
                layout_bbox["x2"],
                layout_bbox["y2"],
            )

            matched = []

            for g in normalized_groups:
                overlap = self.overlap_ratio(
                    g["norm_bbox"],
                    layout_box
                )

                if overlap >= overlap_threshold:
                    matched.append(g)

            assignments[field] = matched

        return assignments

    def merge_assigned_groups(self, assigned_groups):
        """
        Merges multiple assigned groups into a single
        bounding box in normalized coordinates.
        """
        if not assigned_groups:
            return None

        bboxes = [
            g["norm_bbox"]
            for g in assigned_groups
        ]

        x1 = min(b[0] for b in bboxes)
        y1 = min(b[1] for b in bboxes)
        x2 = max(b[2] for b in bboxes)
        y2 = max(b[3] for b in bboxes)

        return (x1, y1, x2, y2)
    
    def iou(self, a, b):
        ix1 = max(a[0], b[0])
        iy1 = max(a[1], b[1])
        ix2 = min(a[2], b[2])
        iy2 = min(a[3], b[3])

        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0

        inter = (ix2 - ix1) * (iy2 - iy1)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter

        return inter / union if union > 0 else 0.0

    def coverage(self, input_bbox, layout_bbox):
        ix1 = max(input_bbox[0], layout_bbox[0])
        iy1 = max(input_bbox[1], layout_bbox[1])
        ix2 = min(input_bbox[2], layout_bbox[2])
        iy2 = min(input_bbox[3], layout_bbox[3])

        if ix2 <= ix1 or iy2 <= iy1:
            return 0.0

        inter = (ix2 - ix1) * (iy2 - iy1)
        layout_area = (
            (layout_bbox[2] - layout_bbox[0]) *
            (layout_bbox[3] - layout_bbox[1])
        )

        return inter / layout_area if layout_area > 0 else 0.0

    def spill_penalty(self, input_bbox, layout_bbox):
        ix1 = max(input_bbox[0], layout_bbox[0])
        iy1 = max(input_bbox[1], layout_bbox[1])
        ix2 = min(input_bbox[2], layout_bbox[2])
        iy2 = min(input_bbox[3], layout_bbox[3])

        inter = 0.0
        if ix2 > ix1 and iy2 > iy1:
            inter = (ix2 - ix1) * (iy2 - iy1)

        input_area = (
            (input_bbox[2] - input_bbox[0]) *
            (input_bbox[3] - input_bbox[1])
        )

        if input_area == 0:
            return 0.0

        spill = (input_area - inter) / input_area
        return spill

    def calculate_field_scores(self, merged_bbox: Optional[Tuple], layout_bbox: Dict) -> Dict[str, float]:
        """Calculates all scores for a specific field"""
        if merged_bbox is None:
            return {
                "iou": 0.0,
                "coverage": 0.0,
                "spill_penalty": 0.0,
                "exists": False
            }
        
        layout_box_tuple = (
            layout_bbox["x1"],
            layout_bbox["y1"],
            layout_bbox["x2"],
            layout_bbox["y2"],
        )
        
        return {
            "iou": self.iou(merged_bbox, layout_box_tuple),
            "coverage": self.coverage(merged_bbox, layout_box_tuple),
            "spill_penalty": self.spill_penalty(merged_bbox, layout_box_tuple),
            "exists": True
        }

    def calculate_final_score(self, field_results: Dict[str, Dict]) -> Dict[str, Any]:
        """Calculate the final score for structural validation"""

        if not field_results:
            return {
                "final_score": 0.0,
                "coverage_ratio": 0.0,
                "average_iou": 0.0,
                "average_coverage": 0.0,
                "average_spill": 0.0,
                "total_fields": 0,
                "detected_fields": 0,
                "field_details": field_results,
                "passes": False
            }

        total_fields = len(field_results)
        detected_fields = sum(1 for r in field_results.values() if r["exists"])

        detected_iou = [r["iou"] for r in field_results.values() if r["exists"]]
        detected_coverage = [r["coverage"] for r in field_results.values() if r["exists"]]
        detected_spill = [r["spill_penalty"] for r in field_results.values() if r["exists"]]

        average_iou = sum(detected_iou) / len(detected_iou) if detected_iou else 0.0
        average_coverage = sum(detected_coverage) / len(detected_coverage) if detected_coverage else 0.0
        average_spill = sum(detected_spill) / len(detected_spill) if detected_spill else 0.0
        coverage_ratio = detected_fields / total_fields if total_fields > 0 else 0.0

        final_score = (
            0.4 * coverage_ratio +
            0.3 * average_iou +
            0.2 * average_coverage -
            0.1 * average_spill
        )

        passes_threshold = 0.55

        return {
            "final_score": final_score,
            "coverage_ratio": coverage_ratio,
            "average_iou": average_iou,
            "average_coverage": average_coverage,
            "average_spill": average_spill,
            "total_fields": total_fields,
            "detected_fields": detected_fields,
            "field_details": field_results,
            "passes": final_score >= passes_threshold
        }


    def process_document(self, document_id: str, all_groups: List[List[Dict]], all_img_shapes: List[Tuple[int, int]], overlap_threshold: float = 0.3) -> Dict[str, Any]:
        """
        Process document with multiple pages
        
        Args:
            document_id: ID of layout
            all_groups: List de lists, every sublist contains group of one single page
            all_img_shapes: List of shapes of each image
            overlap_threshold: overlap's threshold
            
        Returns:
            Combined results of all pages
        """
        if document_id not in self.layouts:
            raise ValueError(f"Layout not found for document ID: {document_id}")
        
        layout_data = self.layouts[document_id]
        layout_templates = layout_data["templates"]
        
        # Validate that we have enough pages
        if len(all_groups) < len(layout_templates):
            raise ValueError(
                f"Layout expects {len(layout_templates)} pages, "
                f"but {len(all_groups)} were received"
            )
        
        # Process each page according to its corresponding template
        page_results = []
        
        for page_idx, (page_groups, img_shape) in enumerate(zip(all_groups, all_img_shapes)):
            # Use correct template for this page
            if page_idx < len(layout_templates):
                template_info = layout_templates[page_idx]
                template = template_info["template"]
                side_name = template_info.get("side", f"page_{page_idx}")
            else:
                # if there are more pages than templates, use last template
                template_info = layout_templates[-1]
                template = template_info["template"]
                side_name = f"page_{page_idx}"
            
            # process the page
            page_result = self._process_page(
                page_idx=page_idx,
                side_name=side_name,
                groups=page_groups,
                img_shape=img_shape,
                template=template,
                overlap_threshold=overlap_threshold
            )
            
            page_results.append(page_result)
        
        # combine results of all pages
        combined_results = self._combine_pages_results(page_results, layout_data)        
        return combined_results

    def _process_page(self, page_idx, side_name, groups, img_shape, template, overlap_threshold):
        """Process a single page"""
        # 1. Normalize groups
        normalized_groups = self.normalize_groups(groups, img_shape)
        
        # 2. assign groups to template
        assignments = self.assign_groups_to_layout(
            groups, img_shape, template, overlap_threshold
        )

        # 3. merge grouped regions
        merged_boxes = {}
        for field, assigned_groups in assignments.items():
            merged_bbox = self.merge_assigned_groups(assigned_groups)
            merged_boxes[field] = merged_bbox
        
        # 4. Calculate scores for each field
        field_results = {}
        for field, merged_bbox in merged_boxes.items():
            layout_bbox = template[field]
            field_scores = self.calculate_field_scores(merged_bbox, layout_bbox)
            field_results[field] = field_scores
        
        # 5. Calculate final score
        final_results = self.calculate_final_score(field_results)
        
        # 6. Return all important results
        return {
            "page": page_idx,
            "side": side_name,
            "validation": final_results,      # Final score
            "assignated_groups": merged_boxes, # Merged groups assigned to specific field
            "assignments": assignments,        # Original groups assignated by field
            "img_shape": img_shape
        }

    def _combine_pages_results(self, page_results, layout_data):
        """Combine all pages results"""
        # Combine all extracted data
        extracted_data = {}
        for page_result in page_results:
            for field, data in page_result["assignated_groups"].items():
                field_key = f"page{page_result['page']}_{field}" if len(page_results) > 1 else field
                extracted_data[field_key] = data
        
        # Calculate combined metrics
        page_scores = [p["validation"]["final_score"] for p in page_results]
        avg_score = sum(page_scores) / len(page_scores) if page_scores else 0.0

        
        return {
            "document_type_id": layout_data["document_type_id"],
            "pages": page_results,  # Detailed results per page
            "extracted_data": extracted_data,
            "combined_validation": {
                "final_score": avg_score,
                "page_scores": page_scores,
            }
        }
