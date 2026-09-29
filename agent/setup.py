from setuptools import setup, find_packages

setup(
    name="endpoint-monitor-agent",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "psutil",
        "Pillow",
        "cryptography",
        "requests",
        "PyQt6",
        "pynput",
        "pywin32; platform_system == 'Windows'"
    ],
    extras_require={
        "test": ["pytest"]
    },
    entry_points={
        "console_scripts": [
            "run-agent = src.main:main"
        ]
    }
)