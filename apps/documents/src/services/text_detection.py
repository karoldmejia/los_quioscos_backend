import cv2
import numpy as np
from typing import List, Dict

class TextDetector:

    @staticmethod
    def normalize_text_region(gray: np.ndarray) -> np.ndarray:
        """
        Local normalization for text.
        Reduces shadows and lighting variations.
        """
        return cv2.equalizeHist(gray)

    @staticmethod
    def adaptive_binarization(gray: np.ndarray) -> np.ndarray:
        return cv2.adaptiveThreshold(
            gray,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            blockSize=31,
            C=10
        )

    @staticmethod
    def remove_noise(binary: np.ndarray) -> np.ndarray:
        kernel = np.ones((3, 3), np.uint8)
        opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        return opened

    @staticmethod
    def find_connected_components(binary: np.ndarray) -> List[Dict]:
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary)

        components = []

        for i in range(1, num_labels):  # saltamos fondo
            x, y, w, h, area = stats[i]

            # Filtro geométrico básico
            if area < 20 or area > 5000:
                continue

            component = {
                "bbox": (x, y, x + w, y + h),
                "centroid": centroids[i],
                "height": h,
                "width": w
            }

            components.append(component)

        return components

    @staticmethod
    def group_components_into_lines(components: List[Dict], y_threshold=10) -> List[List[Dict]]:
        components = sorted(components, key=lambda c: c["centroid"][1])

        lines = []

        for comp in components:
            placed = False

            for line in lines:
                avg_y = np.mean([c["centroid"][1] for c in line])
                if abs(comp["centroid"][1] - avg_y) < y_threshold:
                    line.append(comp)
                    placed = True
                    break

            if not placed:
                lines.append([comp])

        return lines

    @staticmethod
    def group_line_into_words(line: List[Dict], gap_threshold=15) -> List[Dict]:
        line = sorted(line, key=lambda c: c["bbox"][0])

        words = []
        current_word = [line[0]]

        for prev, curr in zip(line, line[1:]):
            gap = curr["bbox"][0] - prev["bbox"][2]

            if gap < gap_threshold:
                current_word.append(curr)
            else:
                words.append(current_word)
                current_word = [curr]

        words.append(current_word)

        word_bboxes = []

        for word_id, word in enumerate(words, start=1):
            xs = [c["bbox"][0] for c in word] + [c["bbox"][2] for c in word]
            ys = [c["bbox"][1] for c in word] + [c["bbox"][3] for c in word]

            word_bboxes.append({
                "word_id": word_id,
                "bbox": (min(xs), min(ys), max(xs), max(ys))
            })

        return word_bboxes

    def detect_text_in_region(self, img: np.ndarray, region_bbox) -> Dict:
        x1, y1, x2, y2 = region_bbox
        region = img[y1:y2, x1:x2]

        gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)

        gray = self.normalize_text_region(gray)
        binary = self.adaptive_binarization(gray)
        binary = self.remove_noise(binary)

        components = self.find_connected_components(binary)
        lines_components = self.group_components_into_lines(components)

        lines_output = []

        for line_id, line in enumerate(lines_components, start=1):
            words = self.group_line_into_words(line)

            xs = [c["bbox"][0] for c in line] + [c["bbox"][2] for c in line]
            ys = [c["bbox"][1] for c in line] + [c["bbox"][3] for c in line]

            line_bbox = (
                min(xs) + x1,
                min(ys) + y1,
                max(xs) + x1,
                max(ys) + y1
            )

            for w in words:
                w["bbox"] = (
                    w["bbox"][0] + x1,
                    w["bbox"][1] + y1,
                    w["bbox"][2] + x1,
                    w["bbox"][3] + y1
                )

            lines_output.append({
                "line_id": line_id,
                "bbox": line_bbox,
                "words": words
            })

        return {"lines": lines_output}
