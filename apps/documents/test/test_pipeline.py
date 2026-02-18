import asyncio
from pathlib import Path

from src.document_impl import DocumentService


FIXTURES_PATH = Path(__file__).parent / "fixtures"


def load_files_as_bytes(folder: Path) -> list[bytes]:
    """
    Reads all files in a folder and returns them as bytes.
    Files are sorted to ensure deterministic order.
    """
    files_bytes = []

    for file_path in sorted(folder.iterdir()):
        if file_path.is_file():
            with open(file_path, "rb") as f:
                files_bytes.append(f.read())

    return files_bytes


async def run_test():
    processor = DocumentService()

    files_bytes = load_files_as_bytes(FIXTURES_PATH / "docs")

    # (Opcional) selfie
    #selfie_bytes = None
    selfie_bytes = (FIXTURES_PATH / "selfie" / "selfie.png").read_bytes()

    user_id = 123
    doc_type_id = 1

    result = await processor.process_document(
        user_id=user_id,
        doc_type_id=doc_type_id,
        files_bytes=files_bytes,
        selfie_bytes=selfie_bytes
    )

    print("\n===== PIPELINE RESULT =====")
    print(result)


if __name__ == "__main__":
    asyncio.run(run_test())
