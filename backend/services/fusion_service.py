import json
from collections import Counter
from difflib import SequenceMatcher
from wordfreq import zipf_frequency

# -------------------------------
# 🔹 BBOX MATCH
# -------------------------------
def bbox_close(b1, b2, threshold=10):
    return (
        abs(b1["x"] - b2["x"]) < threshold
        and abs(b1["y"] - b2["y"]) < threshold
    )


# -------------------------------
# 🔹 SIMILARITY
# -------------------------------
def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()


# -------------------------------
# 🔹 DICTIONARY CHECK
# -------------------------------
def is_valid(word):
    return zipf_frequency(word.lower(), "en") > 3


# -------------------------------
# 🔥 MAJORITY VOTING
# -------------------------------
def majority_vote(candidates):

    candidates = [c.strip() for c in candidates if c and c.strip()]

    if not candidates:
        return "", False

    # --------------------------------
    # 1. Exact Majority
    # --------------------------------
    counts = Counter(candidates)

    most_common_word, top_count = counts.most_common(1)[0]

    if top_count > len(candidates) / 2:
        corrected = not all(c == most_common_word for c in candidates)
        return most_common_word, corrected

    # --------------------------------
    # 2. Case Normalized Majority
    # --------------------------------
    norm_map = {}

    for c in candidates:
        key = c.lower()
        norm_map.setdefault(key, []).append(c)

    norm_counts = Counter({
        k: len(v) for k, v in norm_map.items()
    })

    best_norm, best_norm_count = norm_counts.most_common(1)[0]

    if best_norm_count > len(candidates) / 2:

        original_forms = norm_map[best_norm]

        chosen = Counter(original_forms).most_common(1)[0][0]

        corrected = not all(c == chosen for c in candidates)

        return chosen, corrected

    # --------------------------------
    # 3. Similarity Clustering
    # --------------------------------
    unique = list(counts.keys())

    clusters = []

    assigned = set()

    for i, w in enumerate(unique):

        if i in assigned:
            continue

        cluster = [w]

        assigned.add(i)

        for j, other in enumerate(unique):

            if j in assigned:
                continue

            if similarity(w, other) > 0.80:
                cluster.append(other)
                assigned.add(j)

        clusters.append(cluster)

    def cluster_votes(cluster):
        return sum(counts[w] for w in cluster)

    best_cluster = max(clusters, key=cluster_votes)

    valid_words = [w for w in best_cluster if is_valid(w)]

    pool = valid_words if valid_words else best_cluster

    chosen = min(pool, key=len)

    corrected = not all(c == chosen for c in candidates)

    return chosen, corrected


# -------------------------------
# 🔹 FUSION
# -------------------------------
def fuse(model_regions):

    if not model_regions:
        return []

    # First model acts as anchor
    anchor = model_regions[0]

    others = model_regions[1:]

    used_indices = [set() for _ in others]

    fused = []

    for r1 in anchor:

        b1 = r1["bounding_box"]

        t1 = r1["label"]

        all_candidates = [t1]

        # Match with all other models
        for k, other_model in enumerate(others):

            matched_label = None

            for j, r2 in enumerate(other_model):

                if j in used_indices[k]:
                    continue

                if bbox_close(b1, r2["bounding_box"]):

                    matched_label = r2["label"]

                    used_indices[k].add(j)

                    break

            if matched_label:
                all_candidates.append(matched_label)
            else:
                all_candidates.append(t1)

        final_text, corrected = majority_vote(all_candidates)

        fused.append({
            "text": final_text,
            "corrected": corrected,
            "candidates": all_candidates,
            "has_bbox": True,
            "line": r1.get("line", 0),
            "x": b1["x"]
        })

    return fused


# -------------------------------
# 🔹 GROUP BY LINE
# -------------------------------
def group_lines(fused):

    lines = {}

    for w in fused:
        lines.setdefault(w["line"], []).append(w)

    for ln in lines:
        lines[ln].sort(key=lambda x: x["x"])

    return dict(sorted(lines.items()))


# -------------------------------
# 🔹 FORMAT OUTPUT
# -------------------------------
def format_text(lines):

    output = ""

    for line in lines:

        for w in lines[line]:

            word = w["text"]

            if w["corrected"]:
                word = f"_{word}_"

            if w["has_bbox"]:
                word = f"[{word}]"

            output += word + " "

        output += "\n\n"

    return output


# -------------------------------
# 🔹 WRAPPER SERVICE
# -------------------------------
def run_fusion(ocr_results):
    """
    ocr_results: List of dicts, each representing an OCR model's output.
                 Should contain a 'raw_json' key which has a 'regions' list.
    
    Returns:
    - final_text (str): The fused text output formatted.
    - confidence (int): The calculated confidence percentage.
    - reconstructed_json (dict): The new raw_json matching the anchor's bbox coordinates.
    """
    model_regions = []
    
    for res in ocr_results:
        # the OCRResult is a sqlalchemy model, we access raw_json
        raw = res.raw_json if hasattr(res, "raw_json") else res.get("raw_json", {})
        
        regions = []
        if raw:
            if "api_versions" in raw and len(raw["api_versions"]) > 0:
                try:
                    regions = raw["api_versions"][0].get("raw_output", {}).get("regions", [])
                except Exception:
                    regions = []
            else:
                regions = raw.get("regions", [])
                
        model_regions.append(regions)
        
    if not model_regions or not model_regions[0]:
        return "", 0, {"text": "", "regions": []}

    fused_results = fuse(model_regions)
    
    # Calculate confidence score
    total_votes = 0
    matching_votes = 0
    
    for f in fused_results:
        candidates = f.get("candidates", [])
        chosen_text = f.get("text", "")
        for c in candidates:
            if c and c.strip():
                total_votes += 1
                if c.strip() == chosen_text:
                    matching_votes += 1
                    
    confidence = int((matching_votes / total_votes * 100)) if total_votes > 0 else 0
    
    # Generate formatted text
    lines = group_lines(fused_results)
    final_text = format_text(lines)
    
    # Reconstruct raw_json so bounding boxes can be drawn in the UI
    # We deep-copy the anchor regions and replace the label/text with the fused text
    anchor_regions = model_regions[0]
    new_regions = []
    
    for idx, orig_region in enumerate(anchor_regions):
        new_region = orig_region.copy()
        if idx < len(fused_results):
            new_region["label"] = fused_results[idx]["text"]
            new_region["text"] = fused_results[idx]["text"]
        new_regions.append(new_region)
        
    reconstructed_json = {
        "text": final_text,
        "regions": new_regions
    }
    
    return final_text, confidence, reconstructed_json
