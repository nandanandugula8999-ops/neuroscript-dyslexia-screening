"""Copy the two large Random Forest model files from Dys-le into this project.

These files are intentionally not stored in GitHub because the repository is a
public fork and GitHub blocks Git LFS uploads for public forks.
"""

import argparse
import shutil
from pathlib import Path

DEFAULT_SOURCE = Path(r"C:\Users\Nandan\Dys-le\backend\models")
REQUIRED_FILES = (
    "MobileNetV2_RF_Original.pkl",
    "final_clean_cnn_random_forest.pkl",
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Folder containing the large model files (default: {DEFAULT_SOURCE})",
    )
    args = parser.parse_args()

    destination = Path(__file__).resolve().parent / "models"
    destination.mkdir(parents=True, exist_ok=True)

    for name in REQUIRED_FILES:
        source_file = args.source / name
        target_file = destination / name

        if not source_file.is_file():
            print(f"[SKIP] Not found: {source_file}")
            continue

        shutil.copy2(source_file, target_file)
        size_mb = target_file.stat().st_size / (1024 * 1024)
        print(f"[OK] {name} -> {target_file} ({size_mb:.1f} MB)")

    print("Setup complete. The CNN + SVM, MobileNetV2 + SVM, and CNN + RF models are ready.")


if __name__ == "__main__":
    main()
