"""
Kubernetes name sanitization utilities.
"""
import re
from config import Config


def sanitize_k8s_name(name: str) -> str:
    """
    Sanitize a string to make it Kubernetes-compatible (RFC 1123 label).

    Rules:
    - Lowercase alphanumeric characters or '-'
    - Must start and end with alphanumeric character
    - Max 63 characters
    """
    # If name contains @, take only the part before @
    if '@' in name:
        name = name.split('@')[0]

    # Convert to lowercase
    name = name.lower()

    # Replace non-alphanumeric characters with hyphen
    name = re.sub(r'[^a-z0-9-]', '-', name)

    # Replace multiple consecutive hyphens with single hyphen
    name = re.sub(r'-+', '-', name)

    # Remove leading and trailing hyphens
    name = name.strip('-')

    # If empty or invalid, use a default
    if not name:
        name = 'user'

    # Ensure it starts with alphanumeric
    if not name[0].isalnum():
        name = 'u' + name

    # Ensure it ends with alphanumeric
    if not name[-1].isalnum():
        name = name + '0'

    # Truncate to max 63 characters (leaving room for prefix)
    max_suffix_length = 63 - len(Config.K8S_NAMESPACE_PREFIX)
    if len(name) > max_suffix_length:
        name = name[:max_suffix_length].rstrip('-')
        # Ensure still ends with alphanumeric after truncation
        if name and not name[-1].isalnum():
            name = name.rstrip('-') + '0'

    return name


def make_namespace(username: str) -> str:
    """Generate a Kubernetes-compatible namespace name from username."""
    sanitized = sanitize_k8s_name(username)
    return f"{Config.K8S_NAMESPACE_PREFIX}{sanitized}"
