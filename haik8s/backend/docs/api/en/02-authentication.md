# Authentication

HAI-K8S API uses JWT (JSON Web Token) Bearer authentication. All API endpoints (except `/api/auth/*`) require a valid token.

## Authentication Methods

HAI-K8S supports two authentication methods:

1. **Local Authentication** - Using username and password
2. **SSO Authentication** - Through Unified Authentication Platform (UMT)

## Local Authentication

### Login Endpoint

```
POST /api/auth/login/local
```

### Request Body

```json
{
  "username": "your_username",
  "password": "your_password"
}
```

### Response

**Success (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer"
}
```

**Failure (401):**
```json
{
  "detail": "Incorrect username or password"
}
```

### curl Example

```bash
curl -X POST http://localhost:42900/api/auth/login/local \
     -H "Content-Type: application/json" \
     -d '{
       "username": "john",
       "password": "my_secure_password"
     }'
```

### Python Example

```python
import requests

response = requests.post(
    "http://localhost:42900/api/auth/login/local",
    json={
        "username": "john",
        "password": "my_secure_password"
    }
)

if response.status_code == 200:
    token = response.json()["access_token"]
    print(f"Token: {token}")
else:
    print(f"Login failed: {response.json()['detail']}")
```

## Using Token

### HTTP Header Format

All authenticated requests must include the token in the header:

```
Authorization: Bearer <your-jwt-token>
```

### curl Example

```bash
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJh..." \
     http://localhost:42900/api/containers
```

### Python Example

```python
import requests

token = "eyJ0eXAiOiJKV1QiLCJh..."
headers = {"Authorization": f"Bearer {token}"}

# Call API with token
response = requests.get(
    "http://localhost:42900/api/containers",
    headers=headers
)
containers = response.json()
```

## Token Lifecycle

### Expiration

- Default expiration: **24 hours**
- After expiration, re-authentication is required

### Token Invalidation

- Token immediately invalidates after password change
- All user tokens invalidate when admin disables the user

## Error Handling

### 401 Unauthorized

```json
{
  "detail": "Could not validate credentials"
}
```

**Causes:**
- Missing or malformed token
- Expired token
- Invalid token signature

**Solution:**
Re-authenticate to get a new token.

### 403 Forbidden

```json
{
  "detail": "Not enough permissions"
}
```

**Causes:**
- User lacks permission to access the resource
- Admin operation but user is not admin

**Solution:**
Contact administrator for appropriate permissions.

## Security Best Practices

### 1. Token Storage

**Browser:**
- Use `localStorage` or `sessionStorage`
- Avoid cookies (prevent CSRF)

**Mobile/Desktop:**
- Use secure key storage (Keychain/KeyStore)

**Scripts/CLI:**
- Store in config file with 600 permissions
- Use environment variables

### 2. Token Transmission

- **Always use HTTPS** (production)
- Don't pass tokens in URLs
- Don't log full tokens

### 3. Token Rotation

- Periodically re-authenticate for new tokens
- Long-running scripts should implement auto re-authentication

## Next Steps

- **[Containers](containers)**: Create and manage containers
- **[Applications](applications)**: Launch OpenClaw and other apps
- **[Users](users)**: View quotas and usage
