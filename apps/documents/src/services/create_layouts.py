import json
from src.services.semantic_asignation import SemanticAsignation
from src.document_impl import DocumentService
from .layout_service import LayoutService


service = LayoutService()
impl = DocumentService()

doc_dir = service.FIXTURES_PATH / "soat"

files_bytes = service.load_document_files(doc_dir)
images = impl.to_images(files_bytes)

result = service.run(
    images,
    export_layout_debug=True
)

#"""
semantic = SemanticAsignation()

with open(service.SRC_DIR / "layouts" / "soat.layout.json") as f:
    layout_def = json.load(f)

final_templates = []

for idx, img in enumerate(result["normalized_images"]):
    groups = service.segmenter.group_regions(
        result["regions"][idx]
    )

    side = "front" if idx == 0 else "back"
    side_layout = layout_def["sides"].get(side)
    if not side_layout:
        continue

    template = service.build_side_template(
        groups,
        img.shape,
        side_layout
    )

    final_templates.append({
        "side": side,
        "template": template
    })

output_path = service.SRC_DIR / "layouts" / "soat.template.json"

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(
        {
            "document_type": "soat",
            "document_id": 5,
            "version": "v1",
            "templates": final_templates
        },
        f,
        indent=2,
        ensure_ascii=False
    )

print(f"Template guardado en: {output_path}")
#"""
