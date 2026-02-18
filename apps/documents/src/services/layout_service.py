from pathlib import Path

from .semantic_asignation import SemanticAsignation
from .text_detection import TextDetector
from .structural_segmenter import StructuralSegmenter
from .normalization import normalize_document
from .quality_validation import ValidationService
import cv2

class LayoutService:

    SRC_DIR = Path(__file__).resolve().parent.parent
    FIXTURES_PATH = SRC_DIR / "layouts" / "fixtures"

    def __init__(self):
        self.validator = ValidationService()
        self.segmenter = StructuralSegmenter()
        self.text_detector = TextDetector()
        self.normalizer = SemanticAsignation()

    def load_document_files(self, doc_folder: Path = FIXTURES_PATH) -> list[bytes]:
        files_bytes = []

        for file in sorted(doc_folder.iterdir()):
            if file.suffix.lower() in (".jpg", ".jpeg", ".png", ".pdf"):
                files_bytes.append(file.read_bytes())

        return files_bytes
    
    def run(self, images, export_layout_debug: bool = False):
        # 1. Global validation
        self.validator.quality_validation(images)

        # 2. Normalization
        normalized_images = [
            normalize_document(img)
            for img in images
        ]

        # 3. Structural segmentation
        structural_regions = self.segmenter.process_documents(
            normalized_images
        )

        all_text = []

        for idx, (img, regions) in enumerate(
            zip(normalized_images, structural_regions)
        ):
            groups = self.segmenter.group_regions(regions)

            image_text = []

            if export_layout_debug:
                base_dir = self.FIXTURES_PATH / "previews"

                self.export_region_crops(
                    img,
                    groups,
                    base_dir / f"img_{idx}" / "regions",
                    image_id=idx
                )

                self.export_debug_image(
                    img,
                    groups,
                    base_dir / f"img_{idx}" / "debug.png"
                )
        return {
            "normalized_images": normalized_images,
            "regions": structural_regions,
        }

    def crop_region(self, img, bbox):
        x1, y1, x2, y2 = bbox
        h, w = img.shape[:2]

        x1 = max(0, min(x1, w - 1))
        x2 = max(0, min(x2, w))
        y1 = max(0, min(y1, h - 1))
        y2 = max(0, min(y2, h))

        if x2 <= x1 or y2 <= y1:
            return None

        crop = img[y1:y2, x1:x2]

        if crop.size == 0:
            return None

        return crop

    def export_region_crops(self, img, regions, output_dir: Path, image_id: int):
        output_dir.mkdir(parents=True, exist_ok=True)

        for r in regions:
            crop = self.crop_region(img, r["bbox"])

            filename = (
                f"img{image_id}_"
                f"group{r['group_id']}.png"
            )

            if crop is None:
                print(f"[WARN] Empty crop skipped: group {r['group_id']} bbox={r['bbox']}")
                continue

            cv2.imwrite(str(output_dir / filename), crop)

    def export_debug_image(self, img, regions, output_path: Path):
        drawn = img.copy()

        for r in regions:
            x1, y1, x2, y2 = r["bbox"]
            cv2.rectangle(drawn, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(
                drawn,
                f"id:{r['group_id']}",
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.4,
                (0, 255, 0),
                1
            )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(output_path), drawn)

    def build_side_template(self, groups, img_shape, side_layout, margin=0.05):
        groups_by_id = {
            g["group_id"]: g
            for g in groups
        }

        template = {}

        for field, group_ids in side_layout["groups"].items():
            if isinstance(group_ids, int):
                group_ids = [group_ids]

            bboxes = []
            for gid in group_ids:
                if gid in groups_by_id:
                    bboxes.append(groups_by_id[gid]["bbox"])

            if not bboxes:
                continue

            # 1. merge bbox in pixels
            merged = self.normalizer.merge_bboxes(bboxes)

            # 2. normalize (0..1)
            normalized = self.normalizer.normalize_bbox(merged, img_shape)

            # 3. inflate
            inflated = self.inflate_bbox(normalized, margin=margin)

            # 4. round
            final_bbox = self.round_bbox(inflated, decimals=2)

            template[field] = final_bbox

        return template

    # Add error margin
    def inflate_bbox(self, bbox, margin=0.05):
        """
        bbox: dict con x1, y1, x2, y2, width, height
        """
        x1 = bbox["x1"] - margin
        y1 = bbox["y1"] - margin
        x2 = bbox["x2"] + margin
        y2 = bbox["y2"] + margin

        x1 = max(0.0, min(1.0, x1))
        y1 = max(0.0, min(1.0, y1))
        x2 = max(0.0, min(1.0, x2))
        y2 = max(0.0, min(1.0, y2))

        return {
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "width": x2 - x1,
            "height": y2 - y1
        }


    def round_bbox(self, bbox, decimals=2):
        return {
            k: round(v, decimals)
            for k, v in bbox.items()
        }
