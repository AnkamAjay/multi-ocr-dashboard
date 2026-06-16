import asyncio
import time
import httpx
import os
import uuid

async def call_ocr(filename, language, version, modality, layout_model):
    url = "https://ilocr.iiit.ac.in/pageocr/api"
    content_type = "image/jpeg"
    
    async with httpx.AsyncClient() as client:
        with open("uploads/1.jpg", "rb") as f:
            files = {"image": (filename, f, content_type)}
            data = {
                "language": language,
                "version": version,
                "modality": modality,
                "layout_model": layout_model,
                "padding": 0,
                "postprocess": "false",
                "binarize": "false"
            }
            
            start_time = time.time()
            try:
                response = await client.post(url, data=data, files=files, timeout=60.0)
                duration = time.time() - start_time
                return duration, response.status_code
            except Exception as e:
                duration = time.time() - start_time
                return duration, str(e)

async def main():
    print("Testing OCR API Performance...")
    configs = [
        {"name": "Printed_V1", "version": "V-01.10.01.02", "layout": "v2_doctr"},
        {"name": "Printed_V2", "version": "V-01.10.01.03", "layout": "v2_doctr"},
        {"name": "Printed_V3", "version": "V-01.10.01.04", "layout": "v2_doctr"},
    ]
    
    print("\n--- Sequential Execution ---")
    seq_start = time.time()
    for i, cfg in enumerate(configs):
        fname = f"test_seq_{i}.jpg"
        dur, status = await call_ocr(fname, "english", cfg["version"], "printed", cfg["layout"])
        print(f"Model {cfg['name']} took {dur:.2f}s (Status: {status})")
    print(f"Total Sequential Time: {time.time() - seq_start:.2f}s")
    
    print("\n--- Parallel Execution ---")
    par_start = time.time()
    tasks = []
    for i, cfg in enumerate(configs):
        fname = f"test_par_{i}.jpg"
        tasks.append(call_ocr(fname, "english", cfg["version"], "printed", cfg["layout"]))
    
    results = await asyncio.gather(*tasks)
    for cfg, (dur, status) in zip(configs, results):
        print(f"Model {cfg['name']} took {dur:.2f}s (Status: {status})")
    print(f"Total Parallel Time: {time.time() - par_start:.2f}s")

if __name__ == "__main__":
    asyncio.run(main())
