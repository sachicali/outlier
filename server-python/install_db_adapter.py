#!/usr/bin/env python
"""
Helper script to install database adapter using uv
"""

import platform
import subprocess
import sys
import os

def install_database_adapter():
    """Install the appropriate database adapter using uv"""
    system = platform.system().lower()
    
    print(f"Detected {system} system")
    print("Installing psycopg2-binary using uv...")
    
    try:
        # Try to install psycopg2-binary using uv directly
        subprocess.check_call(["uv", "pip", "install", "psycopg2-binary"])
        print("Successfully installed psycopg2-binary using uv")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        try:
            # Fallback: try with python -m uv
            subprocess.check_call([sys.executable, "-m", "uv", "pip", "install", "psycopg2-binary"])
            print("Successfully installed psycopg2-binary using python -m uv")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("Failed to install psycopg2-binary with uv")
            print("Please install database adapter manually:")
            print("  uv pip install psycopg2-binary")
            print("Or see server-python/README.md for alternative installation methods")
            return False

if __name__ == "__main__":
    install_database_adapter()