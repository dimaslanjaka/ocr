import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# set Timezone
os.environ["TZ"] = "Asia/Jakarta"

# determine if application is a script file or frozen exe
if getattr(sys, "frozen", False):
    __CWD__ = os.path.dirname(os.path.realpath(sys.executable))
elif __file__:
    __CWD__ = os.getcwd()


def is_nuitka() -> bool:
    """
    Check if the script is compiled with Nuitka.
    """
    _is_nuitka = "__compiled__" in globals()
    _is_nuitka2 = "NUITKA_ONEFILE_PARENT" in os.environ
    return _is_nuitka or _is_nuitka2


is_nuitka_standalone = "__compiled__" in globals()
is_nuitka_onefile = "NUITKA_ONEFILE_PARENT" in os.environ


def get_nuitka_file(file_path: str) -> str:
    """
    Get the path for a file within a Nuitka compiled application.

    Args:
        file_path (str): The file path.

    Returns:
        str: The absolute file path.
    """
    # Get the directory of the current script (func.py)
    script_dir = os.path.dirname(__file__)
    # Go up one directory level to the root of the project
    root_dir = os.path.dirname(script_dir)
    return os.path.join(root_dir, file_path)


def get_relative_path(*args: str) -> str:
    """
    Get the relative path from the current working directory (CWD).

    Args:
        *args (Union[str, bytes]): Variable number of path components.

    Returns:
        str: The normalized relative path.
    """
    join_path = os.path.join(*args)
    result = os.path.normpath(str(os.path.join(__CWD__, join_path)))
    if is_nuitka():
        result = os.path.normpath(
            str(os.path.join(os.path.dirname(sys.argv[0]), join_path))
        )
        # debug_log(os.path.dirname(sys.argv[0]), os.path.join(*args))
    return result
