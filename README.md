
# Link Preview API Documentation

## Overview

The Link Preview API fetches metadata and preview information about a given URL, such as the title, description, images, and favicons. It is built with Express and deployed on Vercel, supporting CORS for cross-origin requests.

---

## Base URL

```
https://azizbecha-link-preview-api.vercel.app
```

---

## Endpoints

### GET /

- **Description:** Health check endpoint to confirm API is running.
- **Request:**

  ```
  GET /
  ```

- **Response:**

  ```json
  {
    "status": 200,
    "statusText": "API is running"
  }
  ```

---

### GET /get

- **Description:** Fetches link preview metadata for the specified URL.

- **Request:**

  ```
  GET /get?url={url}&timeout={timeout}
  ```

- **Query Parameters:**

  | Parameter | Type   | Required | Description                                   |
  | --------- | ------ | -------- | --------------------------------------------- |
  | url       | string | Yes      | The URL to generate the link preview for.    |
  | timeout   | number | No       | Timeout in milliseconds for fetching preview. Minimum and maximum enforced. Defaults to 5000 ms. |

- **Response:**

  - **Success (HTTP 200):**

    ```json
    {
      "status": 200,
      "title": "GitHub · Build and ship software on a single, collaborative platform",
      "description": "Join the world's most widely adopted, AI-powered developer platform where millions of developers, businesses, and the largest open source community build software that advances humanity.",
      "url": "https://github.com/",
      "images": [
        "https://images.ctfassets.net/8aevphvgewt8/4UxhHBs2XnuyZ4lYQ83juV/b61529b087aeb4a318bda311edf4c345/home24.jpg"
      ],
      "favicons": [
        "https://github.githubassets.com/favicons/favicon.svg"
      ],
      "mediaType": "object",
      "contentType": "text/html",
      "siteName": "GitHub"
    }
    ```

  - **Client Errors (HTTP 400):**

    ```json
    {
      "error": "Missing 'url' query parameter"
    }
    ```

    or

    ```json
    {
      "error": "Invalid 'url' query parameter"
    }
    ```

  - **Server Errors (HTTP 500):**

    ```json
    {
      "error": "Failed to fetch link preview"
    }
    ```

---

## Notes

- The `timeout` parameter is clamped between 1000 and 30000 to avoid excessive delays or immediate timeouts.
- The API follows redirects automatically.
- CORS is enabled for all origins to allow cross-origin requests.
- URLs passed to the API are normalized before processing.

---

## Example Request

```bash
curl "https://azizbecha-link-preview-api.vercel.app/get?url=https%3A%2F%2Fgithub.com&timeout=3000"
```

---

## Contact

For issues or questions, please contact:  
**Aziz Becha**  
Email: aziz07becha@gmail.com
