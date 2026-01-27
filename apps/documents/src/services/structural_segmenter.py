from typing import List, Dict, Tuple
import cv2
import numpy as np


class StructuralSegmenter:
    """
    Structural document segmentation based on visual blocks:
    - Connected Components
    - Contours with hierarchy
    - Hough lines (for reinforcement)
    """

    def __init__(self):
        pass

    def preprocess(self, img: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        binary = cv2.threshold(
            gray, 0, 255,
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )[1]

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)

        return binary

    def connected_components(self, binary: np.ndarray) -> List[Dict]:
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            binary, connectivity=8
        )

        components = []
        for i in range(1, num_labels):  # skip background
            x, y, w, h, area = stats[i]
            cx, cy = centroids[i]

            components.append({
                "bbox": (x, y, x + w, y + h),
                "area": area,
                "width": w,
                "height": h,
                "centroid": (cx, cy)
            })

        return components

    def filter_components(self, components: List[Dict], img_shape: Tuple[int, int]) -> List[Dict]:

        h, w = img_shape[:2]
        filtered = []

        for c in components:
            if c["area"] < 40:
                continue
            if c["width"] < 5 or c["height"] < 5:
                continue
            if c["area"] > w * h * 0.95:
                continue

            filtered.append(c)

        return filtered
    
    def group_components(self, components: List[Dict], max_distance: int = 10) -> List[Dict]:

        blocks = []

        for comp in components:
            x1, y1, x2, y2 = comp["bbox"]
            added = False

            for block in blocks:
                bx1, by1, bx2, by2 = block["bbox"]

                dx = max(0, max(bx1 - x2, x1 - bx2))
                dy = max(0, max(by1 - y2, y1 - by2))

                if dx < max_distance and dy < max_distance:
                    block["bbox"] = (
                        min(bx1, x1),
                        min(by1, y1),
                        max(bx2, x2),
                        max(by2, y2),
                    )
                    block["components"].append(comp)
                    added = True
                    break

            if not added:
                blocks.append({
                    "bbox": comp["bbox"],
                    "components": [comp]
                })

        return blocks

    def contour_blocks(self, binary: np.ndarray) -> List[Dict]:
        contours, hierarchy = cv2.findContours(
            binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
        )

        blocks = []

        if hierarchy is None:
            return blocks

        hierarchy = hierarchy[0]

        for i, cnt in enumerate(contours):
            x, y, w, h = cv2.boundingRect(cnt)
            area = cv2.contourArea(cnt)

            if area < 600:
                continue

            blocks.append({
                "bbox": (x, y, x + w, y + h),
                "area": area,
                "hierarchy": hierarchy[i]
            })

        return blocks

    def detect_lines(self, binary: np.ndarray):
        edges = cv2.Canny(binary, 50, 150)

        lines = cv2.HoughLinesP(
            edges,
            rho=1,
            theta=np.pi / 180,
            threshold=150,
            minLineLength=100,
            maxLineGap=10
        )

        vertical, horizontal = [], []

        if lines is not None:
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if abs(x1 - x2) < 10:
                    vertical.append((x1, y1, x2, y2))
                elif abs(y1 - y2) < 10:
                    horizontal.append((x1, y1, x2, y2))

        return vertical, horizontal

    def merge_blocks(self, cc_blocks: List[Dict], contour_blocks: List[Dict]) -> List[Dict]:

        merged = cc_blocks.copy()

        for cblock in contour_blocks:
            cx1, cy1, cx2, cy2 = cblock["bbox"]
            matched = False

            for block in merged:
                bx1, by1, bx2, by2 = block["bbox"]

                if cx1 >= bx1 and cy1 >= by1 and cx2 <= bx2 and cy2 <= by2:
                    matched = True
                    break

            if not matched:
                merged.append({
                    "bbox": cblock["bbox"],
                    "components": []
                })

        return merged
    
    # Detect photo
    def is_candidate_photo_region(self, region, img_shape):
        x1, y1, x2, y2 = region["bbox"]
        area = (x2 - x1) * (y2 - y1)
        img_area = img_shape[0] * img_shape[1]

        return (
            area > img_area * 0.01 and
            region["density"] > 0.6
        )

    def texture_score(self, gray_roi):
        lap = cv2.Laplacian(gray_roi, cv2.CV_64F)
        return lap.var()

    def is_photo_like(self, img, bbox):
        x1, y1, x2, y2 = bbox
        gray = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
        score = self.texture_score(gray)
        return score > 150

    # Distance between regions
    def bbox_distance(self, a, b):
        ax1, ay1, ax2, ay2 = a
        bx1, by1, bx2, by2 = b

        dx = max(0, max(ax1 - bx2, bx1 - ax2))
        dy = max(0, max(ay1 - by2, by1 - ay2))

        return dx + dy
    
    # Vertical and horizintal alineation
    def vertical_overlap_ratio(self, a, b):
        ay1, ay2 = a[1], a[3]
        by1, by2 = b[1], b[3]

        overlap = max(0, min(ay2, by2) - max(ay1, by1))
        min_height = min(ay2 - ay1, by2 - by1)

        return overlap / min_height if min_height > 0 else 0
    
    def horizontal_overlap_ratio(self, a, b):
        ax1, ax2 = a[0], a[2]
        bx1, bx2 = b[0], b[2]

        overlap = max(0, min(ax2, bx2) - max(ax1, bx1))
        min_width = min(ax2 - ax1, bx2 - bx1)

        return overlap / min_width if min_width > 0 else 0

    # Group regions
    def group_regions(self, regions, max_distance=15):
        groups = []

        for region in regions:

            if region["type"] == "photo":
                groups.append({
                    "group_id": len(groups) + 1,
                    "type": "photo",
                    "regions": [region],
                    "bbox": region["bbox"]
                })
                continue

            added = False

            for group in groups:

                if group["type"] != "text_block":
                    continue

                dist = self.bbox_distance(region["bbox"], group["bbox"])

                v_overlap = self.vertical_overlap_ratio(
                    region["bbox"], group["bbox"]
                )

                h_overlap = self.horizontal_overlap_ratio(
                    region["bbox"], group["bbox"]
                )

                should_merge = (
                    dist < max_distance and
                    (
                        v_overlap > 0.2 or
                        h_overlap > 0.4
                    )
                )

                if should_merge:
                    x1, y1, x2, y2 = group["bbox"]
                    rx1, ry1, rx2, ry2 = region["bbox"]

                    group["bbox"] = (
                        min(x1, rx1),
                        min(y1, ry1),
                        max(x2, rx2),
                        max(y2, ry2),
                    )

                    group["regions"].append(region)
                    added = True
                    break

            if not added:
                groups.append({
                    "group_id": len(groups) + 1,
                    "type": "text_block",
                    "regions": [region],
                    "bbox": region["bbox"]
                })

        return groups


    # MAIN SEGMENTATION
    def segment_image(self, img: np.ndarray) -> List[Dict]:
        binary = self.preprocess(img)

        components = self.connected_components(binary)
        components = self.filter_components(components, img.shape)

        cc_blocks = self.group_components(components)
        contour_blocks = self.contour_blocks(binary)

        blocks = self.merge_blocks(cc_blocks, contour_blocks)

        regions = []
        for i, block in enumerate(blocks):
            x1, y1, x2, y2 = block["bbox"]

            roi_binary = binary[y1:y2, x1:x2]
            if roi_binary.size == 0:
                continue

            density = np.mean(roi_binary > 0)

            region_type = "text"

            candidate = self.is_candidate_photo_region(
                {"bbox": (x1, y1, x2, y2), "density": density},
                img.shape
            )

            if candidate and self.is_photo_like(img, (x1, y1, x2, y2)):
                region_type = "photo"

            region = {
                "region_id": i + 1,
                "bbox": (x1, y1, x2, y2),
                "width": x2 - x1,
                "height": y2 - y1,
                "area": (x2 - x1) * (y2 - y1),
                "density": float(density),
                "type": region_type,
                "position": (
                    "upper" if y1 < img.shape[0] * 0.33
                    else "center" if y1 < img.shape[0] * 0.66
                    else "lower"
                )
            }

            regions.append(region)


        return regions

    # Main function
    def process_documents(self, normalized_images: List[np.ndarray]) -> List[List[Dict]]:

        return [
            self.segment_image(img)
            for img in normalized_images
        ]

