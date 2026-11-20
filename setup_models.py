"""Install the two large Random Forest model files.

Local usage copies them from your Dys-le folder. Deployment usage downloads
them from the GitHub Release tagged `models-v1`.
"""

import argparse
import shutil
import urllib.request
from pathlib import Path

DEFAULT_SOURCE = Path(r"C:\Users\Nandan\Dys-le\backend\models")
RELEASE_BASE = (
    "https://github.com/nandanandugula8999-ops/neuroscript-dyslexia-screening/"
    "releases/download/models-v1"
)
MODEL_FILES = {
    "MobileNetV2_RF_Original.pkl": f"{RELEASE_BASE}/MobileNetV2_RF_Original.pkl",
    "final_clean_cnn_random_forest.pkl": f"{RELEASE_BASE}/final_clean_cnn_random_forest.pkl",
}
EXPECTED_SIZES = {
    "MobileNetV2_RF_Original.pkl": 320_978_513,
    "final_clean_cnn_random_forest.pkl": 267_059_841,
}


def already_installed(target):
    return target.is_file() and target.stat().st_size == EXPECTED_SIZES[target.name]


def download_file(url, target):
    partial = target.with_name(target.name + ".part")
    print(f"[DOWNLOAD] {target.name} ({EXPECTED_SIZES[target.name] / 1024 / 1024:.1f} MB)")
    with urllib.request.urlopen(url, timeout=120) as response, open(partial, "wb") as output:
        shutil.copyfileobj(response, output, length=1024 * 1024)
    partial.replace(target)
    print(f"[OK] {target.name}")


def copy_file(source, target):
    if not source.is_file():
        print(f"[SKIP] Not found: {source}")
        print("       Run with --download to fetch from GitHub Releases.")
        return
    shutil.copy2(source, target)
    print(f"[OK] {target.name} ({target.stat().st_size / 1024 / 1024:.1f} MB)")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help=f"Local folder containing the model files (default: {DEFAULT_SOURCE})",
    )
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download models from the GitHub Release instead of copying locally",
    )
    args = parser.parse_args()

    destination = Path(__file__).resolve().parent / "models"
    destination.mkdir(parents=True, exist_ok=True)

    for name, url in MODEL_FILES.items():
        target = destination / name
        if already_installed(target):
            print(f"[EXISTS] {name}")
            continue
        if args.download:
            download_file(url, target)
        else:
            copy_file(args.source / name, target)

    print("Setup complete.")


if __name__ == "__main__":
    main()
