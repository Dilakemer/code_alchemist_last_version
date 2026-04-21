"""Runtime compatibility shims loaded automatically by Python.

This module is imported by Python at startup (when present on sys.path).
We patch datetime.utcnow at module level for third-party libraries that
incorrectly call datetime.utcnow() instead of datetime.datetime.utcnow().
"""

import datetime

if not hasattr(datetime, "utcnow"):
    datetime.utcnow = datetime.datetime.utcnow
