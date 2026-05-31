"""IMGCHEST Uploader - Fast Batch Image Uploader Backend"""
import webview
import threading
import requests
import os
import time
import sys

import json

CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')
DEFAULT_API_KEY = ""

def load_api_key():
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('api_key', DEFAULT_API_KEY)
    except Exception:
        pass
    return DEFAULT_API_KEY

def save_api_key(key):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump({'api_key': key}, f, indent=4)
        return True
    except Exception:
        return False

API_KEY = load_api_key()
API_URL = "https://api.imgchest.com/v1/post"
BATCH_SIZE = 19

class PyWebViewApi:
    def __init__(self, window=None):
        self._window = window
        self.files = []
        self.urls = []
        self.post_id = None
        self.post_link = None
        self.uploading = False

    def selectFiles(self):
        file_types = ('Image Files (*.png;*.jpg;*.jpeg;*.gif;*.webp;*.bmp)', 'All files (*.*)')
        res = self._window.create_file_dialog(webview.OPEN_DIALOG, allow_multiple=True, file_types=file_types)
        if res:
            self.files = sorted(list(res), key=lambda x: os.path.basename(x).lower())
            self.urls = []
            self.post_id = None
            self.post_link = None
            self.log(f"Staged {len(self.files)} images (sorted alphabetically).", "ok")
            return self.files
        return []

    def clearState(self):
        self.files = []
        self.urls = []
        self.post_id = None
        self.post_link = None
        self.uploading = False
        self.log("Staging workspace cleared.", "info")

    def copyToClipboard(self, text):
        try:
            import tkinter as tk
            r = tk.Tk()
            r.withdraw()
            r.clipboard_clear()
            r.clipboard_append(text)
            r.update()
            r.destroy()
            self.log("Copied to clipboard.", "ok")
        except Exception as e:
            self.log(f"Clipboard sync failed: {str(e)}", "err")

    def getApiKey(self):
        return load_api_key()

    def saveApiKey(self, key):
        global API_KEY
        cleaned_key = key.strip() if key else ""
        if save_api_key(cleaned_key):
            API_KEY = cleaned_key
            self.log("API Key saved permanently.", "ok")
            return True
        else:
            self.log("Failed to save API Key locally.", "err")
            return False

    def startUpload(self, file_paths):
        if not file_paths or self.uploading:
            return False
        self.files = file_paths
        self.uploading = True
        self.urls = []
        self.post_id = None
        self.post_link = None
        threading.Thread(target=self._run_upload, daemon=True).start()
        return True

    def log(self, msg, tag="info"):
        escaped_msg = msg.replace("'", "\\'").replace('"', '\\"')
        self._window.evaluate_js(f"if (window.onLog) window.onLog('{escaped_msg}', '{tag}')")

    def progress(self, pct, label):
        escaped_label = label.replace("'", "\\'").replace('"', '\\"')
        self._window.evaluate_js(f"if (window.onUploadProgress) window.onUploadProgress({pct}, '{escaped_label}')")

    def batch_complete(self, urls, post_link=None):
        import json
        urls_json = json.dumps(urls)
        if post_link:
            self._window.evaluate_js(f"if (window.onBatchComplete) window.onBatchComplete({urls_json}, '{post_link}')")
        else:
            self._window.evaluate_js(f"if (window.onBatchComplete) window.onBatchComplete({urls_json})")

    def upload_done(self):
        self._window.evaluate_js("if (window.onUploadDone) window.onUploadDone()")

    def _upload_batch(self, files, post_id=None):
        headers = {"Authorization": f"Bearer {API_KEY}"}
        fdata = [(open(f, 'rb'), os.path.basename(f)) for f in files]
        try:
            url = API_URL if not post_id else f"{API_URL}/{post_id}/add"
            r = requests.post(url, headers=headers, files=[('images[]', (n, f, 'image/jpeg')) for f, n in fdata], data={'privacy': 'hidden'}, timeout=120)
            [f.close() for f, _ in fdata]
            if r.status_code in [200, 201]:
                d = r.json().get('data', {})
                imgs = d.get('images', [])[-len(files):] if post_id else d.get('images', [])
                return (True, d.get('id'), [i['link'] for i in imgs])
            return (False, None, f"HTTP Status {r.status_code}")
        except Exception as e:
            [f.close() for f, _ in fdata]
            return (False, None, str(e))

    def _run_upload(self):
        total = len(self.files)
        batches = [self.files[i:i+BATCH_SIZE] for i in range(0, total, BATCH_SIZE)]
        self.log(f"Executing uploader for {total} images in {len(batches)} batch(es)...", "info")
        done = 0

        for i, batch in enumerate(batches, 1):
            self.log(f"Uploading Batch {i}/{len(batches)} ({len(batch)} images)...", "info")
            self.progress(int(done / total * 100), f"Batch {i}/{len(batches)}...")
            ok, pid, res = self._upload_batch(batch, self.post_id)
            if ok:
                if not self.post_id:
                    self.post_id = pid
                    self.post_link = f"https://imgchest.com/p/{pid}"
                self.urls.extend(res)
                done += len(batch)
                self.batch_complete(res, self.post_link if i == 1 else None)
                for u in res:
                    self.log(f"✓ Uploaded: {os.path.basename(u)}", "ok")
            else:
                self.log(f"✗ Batch {i} upload error: {res}", "err")
            
            self.progress(int(done / total * 100), f"{done}/{total} complete")
            if i < len(batches):
                time.sleep(0.3)

        self.uploading = False
        self.log(f"Batch upload finished. {done}/{total} images hosted successfully.", "ok")
        self.upload_done()

def main():
    use_dev_server = len(sys.argv) > 1 and sys.argv[1] == '--dev'
    
    if use_dev_server:
        url = 'http://localhost:5173'
    else:
        dist_path = os.path.join(os.path.dirname(__file__), 'frontend', 'dist', 'index.html')
        if os.path.exists(dist_path):
            url = dist_path
        else:
            url = 'http://localhost:5173'
            
    api = PyWebViewApi()
    window = webview.create_window(
        title='IMGCHEST Uploader',
        url=url,
        width=1150,
        height=780,
        min_size=(950, 650),
        background_color='#0a0f1e',
        js_api=api
    )
    api._window = window
    
    webview.start(debug=use_dev_server)

if __name__ == "__main__":
    main()
