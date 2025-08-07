import os
import shlex
import subprocess
import sys
import shutil


def detect_docker():
    """Detect if running inside Docker on Windows or Linux."""
    try:
        # Common Docker indicator files (Linux & Windows)
        if (
            os.path.exists("/.dockerenv")
            or os.path.exists(r"C:/.dockerenv")
            or os.path.exists(r"\\.\pipe\docker_engine")
        ):
            return True

        # Environment variables set by some Docker images
        if (
            os.environ.get("DOTNET_RUNNING_IN_CONTAINER")
            or os.environ.get("container", "").lower() == "container"
        ):
            return True

        # Linux-specific checks
        if os.path.exists("/proc/1/cgroup"):
            with open("/proc/1/cgroup", "rt") as f:
                content = f.read()
                if any(
                    keyword in content
                    for keyword in ("docker", "containerd", "kubepods")
                ):
                    return True

        if os.path.exists("/proc/self/mountinfo"):
            with open("/proc/self/mountinfo", "rt") as f:
                if "overlay" in f.read():
                    return True

        # Windows-specific: check systeminfo output for "Container"
        try:
            result = subprocess.run(
                ["systeminfo"], capture_output=True, text=True, shell=True
            )
            if "Container" in result.stdout:
                return True
        except Exception:
            pass

    except Exception:
        pass

    return False


cpu_cores = os.cpu_count() or 1
IS_DOCKER = detect_docker()
ISWIN = os.name == "nt"
__dirname = os.path.dirname(os.path.abspath(__file__)).replace("\\", "/")
COMPANY_NAME = "WMI"
VERSION = "1.0.0.0"
ICON = "public/favicon.ico"
if IS_DOCKER:
    PYTHON_CMD = "python"
elif not ISWIN:
    PYTHON_CMD = f"{__dirname}/ppy"
else:
    PYTHON_CMD = f"{__dirname}/ppy.cmd"
release_dir = os.path.normpath(os.path.join(__dirname, "../releases"))


def _log_info(msg):
    sys.stdout.write(f"[INFO] {msg}\n")


def _log_error(msg):
    sys.stderr.write(f"[ERROR] {msg}\n")


def build_scanner():
    filename = "vscan.exe" if ISWIN else "vscan"
    release_path = os.path.normpath(os.path.join(release_dir, filename))
    dist_path = os.path.normpath(os.path.join(__dirname, "../dist", filename))
    if ISWIN:
        nuitka_os_args = [
            f"--windows-icon-from-ico={ICON}",
            f"--windows-company-name={COMPANY_NAME}",
            "--windows-product-name=Voucher Scanner",
            f"--windows-file-version={VERSION}",
            "--msvc=latest",
        ]
    else:
        nuitka_os_args = []
    nuitka_cmd = [
        PYTHON_CMD,
        "-m",
        "nuitka",
        "--onefile",
        "--output-dir=dist",
        f"--output-file={filename}",
        "--include-data-file=public/favicon.ico=favicon.ico",
        "--include-data-dir=test/fixtures/=test/fixtures/",
        f"--jobs={cpu_cores}",
        "--noinclude-unittest-mode=allow",
        "--experimental=debug-report-traceback",
        *map(str, nuitka_os_args),
        "src/ocr/cli.py",
    ]
    _log_info(
        f"Running Nuitka build: {' '.join(shlex.quote(str(x)) for x in nuitka_cmd)}"
    )
    result = subprocess.run(nuitka_cmd)
    if result.returncode != 0:
        _log_error("Nuitka build failed")
        sys.exit(result.returncode)
    else:
        # Copy the dist binary to release directory
        if not os.path.exists(dist_path):
            _log_error(f"Expected build output not found: {dist_path}")
            sys.exit(1)
        os.makedirs(release_dir, exist_ok=True)
        shutil.copy2(dist_path, release_path)


if __name__ == "__main__":
    build_scanner()
    _log_info("Build completed successfully.")
