from setuptools import setup, find_packages

setup(
    name="endpoint-monitor-agent",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "psutil", "Pillow", "cryptography", "requests", "PyQt6", "pynput"
    ],
    entry_points={
        "console_scripts": [
            "run-agent = src.main:main"
        ]
    }
)