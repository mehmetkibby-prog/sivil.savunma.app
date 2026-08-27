#!/usr/bin/env python3
import json, re, sys, shutil
from pathlib import Path

root = Path(sys.argv[1])
res = root / "resources"
out_www = Path(sys.argv[2])
out_www.mkdir(parents=True, exist_ok=True)

def load_json(name):
    p = res / name
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8-sig"))
    except Exception as e:
        print("JSON okunamadı:", name, e)
        return None

def first(d, keys, default=None):
    if not isinstance(d, dict): return default
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default

def human_title(name):
    s = name.replace(".json","").replace("_"," ").replace("-"," ")
    repl = {
      "real exam anayasa 108":"Anayasa • 108 Kaynak Sorusu",
      "real exam anayasa ek 30":"Anayasa • Ek 30 Kaynak Sorusu",
      "real exam atama disiplin 13":"Atama ve Disiplin • 13 Kaynak Sorusu",
      "real exam siginak yasasi 13":"Sığınak Yasası • 13 Kaynak Sorusu",
      "real exam sivil savunma yasasi 20":"Sivil Savunma Yasası • 20 Kaynak Sorusu",
      "real exam teskilat donatim 30":"Teşkilat ve Donatım • 30 Kaynak Sorusu",
      "reis genel kultur 251":"REİS • Genel Kültür 1–251",
      "kibris cografyasi 30":"Kıbrıs Coğrafyası",
      "kibris tarihi 30 yuzeysel":"Kıbrıs Tarihi",
      "afet reis6":"Afet Yönetimi • REİS"
    }
    return repl.get(s.lower(), s.title())

def norm_text(x):
    if x is None: return ""
    if isinstance(x, list): return ", ".join(str(v) for v in x)
    if isinstance(x, dict): return json.dumps(x, ensure_ascii=False)
    return str(x).strip()

def answer_kind(ans):
    a = ans.strip()
    if re.fullmatch(r"\d{1,4}", a): return "num"
    if re.fullmatch(r"\d+(?:[.,]\d+)?\s*(?:km²|km2|km|m|cm|yıl|gün|saat|kişi|oy|milletvekili|%)?", a, re.I): return "measure"
    return "text"

def numeric_distractors(ans):
    m = re.match(r"^\s*(\d+(?:[.,]\d+)?)\s*(.*)$", ans)
    if not m: return []
    raw, unit = m.group(1), m.group(2).strip()
    dec = "," in raw or "." in raw
    val = float(raw.replace(",", "."))
    year = (not dec and 1800 <= val <= 2100)
    if year:
        deltas = [-1, 1, -5, 5, -10, 10]
    elif val <= 10:
        deltas = [-1, 1, 2, -2, 3]
    elif val <= 100:
        deltas = [-5, 5, -10, 10, 2]
    else:
        deltas = [-10, 10, -50, 50, -100, 100]
    out=[]
    for d in deltas:
        nv=val+d
        if nv <= 0: continue
        if dec:
            s=("%g"%nv).replace(".",",")
        else:
            s=str(int(round(nv)))
        if unit: s += " " + unit
        if s != ans and s not in out: out.append(s)
    return out[:3]

def extract_records(obj):
    if isinstance(obj, list):
        return [x for x in obj if isinstance(x, dict)]
    if not isinstance(obj, dict):
        return []
    for key in ["questions","items","data","multipleChoice","quiz","sorular"]:
        if isinstance(obj.get(key), list):
            return [x for x in obj[key] if isinstance(x, dict)]
    # recurse only one level, preferring question-looking arrays
    cand=[]
    for v in obj.values():
        if isinstance(v, list) and v and all(isinstance(x,dict) for x in v):
            score=sum(1 for x in v if any(k in x for k in ["stem","prompt","question","soru","options","choices","answerText","correctIndex"]))
            if score: cand.append((score,v))
    if cand:
        return max(cand,key=lambda t:t[0])[1]
    return []

def normalize_records(records, set_id, title):
    answer_pool=[]
    for r in records:
        ans=first(r,["answerText","correctAnswer","cevapText","cevap","correct","dogruCevap"])
        if isinstance(ans,(str,int,float)):
            answer_pool.append(norm_text(ans))

    out=[]
    for idx,r in enumerate(records,1):
        stem = norm_text(first(r,["stem","prompt","question","soru","text","title"]))
        if not stem or len(stem) < 3: 
            continue

        options = first(r,["options","choices","secenekler","şıklar"],[])
        if not isinstance(options,list): options=[]
        options=[norm_text(x) for x in options if norm_text(x)]

        ci = first(r,["correctIndex","answerIndex","correct_index","dogruIndex"],None)
        ans = first(r,["answerText","correctAnswer","cevapText","cevap","correct","dogruCevap"],None)

        if isinstance(ci,str) and ci.isdigit(): ci=int(ci)
        if isinstance(ci,float) and ci.is_integer(): ci=int(ci)
        if isinstance(ans,int) and options and 0 <= ans < len(options) and ci is None:
            ci=ans; ans=options[ci]
        elif isinstance(ans,str) and options and ci is None:
            try: ci=options.index(ans)
            except ValueError: pass

        if ci is not None and isinstance(ci,int) and 0 <= ci < len(options):
            ans_text=options[ci]
        else:
            ans_text=norm_text(ans)

        # Source-page style: one answer under the question, no choices.
        if not options and ans_text:
            ds=numeric_distractors(ans_text)
            if len(ds)<3:
                kind=answer_kind(ans_text)
                for cand in answer_pool:
                    if cand == ans_text: continue
                    if answer_kind(cand)==kind and abs(len(cand)-len(ans_text)) <= max(8,len(ans_text)):
                        ds.append(cand)
                    if len(ds)>=3: break
            generic=["Hiçbiri","Yukarıdakilerin tümü","Belirtilmemiştir"]
            for g in generic:
                if len(ds)>=3: break
                if g != ans_text and g not in ds: ds.append(g)
            options=[ans_text]+ds[:3]
            ci=0
        elif options and ci is None and ans_text:
            if ans_text in options: ci=options.index(ans_text)
        if not options or ci is None or not (0 <= int(ci) < len(options)):
            # Non-test note; skip rather than invent wrong answer.
            continue

        exp=norm_text(first(r,["explanation","tip","feedback","sourceAnswerNote","note","aciklama"],""))
        ref=norm_text(first(r,["reference","sourceRef","constitutionArticle","madde","source"],""))
        qid=norm_text(first(r,["id","number","no"],f"{set_id}-{idx}"))
        out.append({
          "id": f"{set_id}:{qid}",
          "stem": stem,
          "options": options,
          "correctIndex": int(ci),
          "answerText": options[int(ci)],
          "explanation": exp,
          "reference": ref,
          "number": first(r,["number","no"],idx)
        })
    return out

sets=[]

# Subjects metadata, if available
subjects_obj=load_json("subjects.json")
subjects=[]
if isinstance(subjects_obj,list): subjects=subjects_obj
elif isinstance(subjects_obj,dict):
    subjects=subjects_obj.get("subjects",[]) if isinstance(subjects_obj.get("subjects"),list) else []

subject_map={}
for s in subjects:
    if isinstance(s,dict):
        sid=norm_text(first(s,["id","subjectID","key"]))
        st=norm_text(first(s,["title","name"]))
        if sid and st: subject_map[sid]=st

# Main subject question bank
qobj=load_json("questions.json")
qrecords=extract_records(qobj)
if qrecords:
    grouped={}
    for r in qrecords:
        sid=norm_text(first(r,["subjectID","subjectId","lawId","subject"],"genel"))
        grouped.setdefault(sid,[]).append(r)
    for sid,recs in grouped.items():
        qs=normalize_records(recs,"subject-"+sid,subject_map.get(sid,sid.title()))
        if qs: sets.append({"id":"subject-"+sid,"title":subject_map.get(sid,sid.title()),"category":"subjects","questions":qs})

# Named source/test files
file_specs=[
 ("real_exam_anayasa_108.json","real"),
 ("real_exam_anayasa_ek_30.json","real"),
 ("real_exam_atama_disiplin_13.json","real"),
 ("real_exam_siginak_yasasi_13.json","real"),
 ("real_exam_sivil_savunma_yasasi_20.json","real"),
 ("real_exam_teskilat_donatim_30.json","real"),
 ("real_exam_questions.json","real"),
 ("reis_genel_kultur_251.json","general"),
 ("kibris_cografyasi_30.json","cygeo"),
 ("kibris_tarihi_30_yuzeysel.json","cyhist"),
 ("afet_reis6.json","afet"),
]
for fn,cat in file_specs:
    obj=load_json(fn)
    if obj is None: continue
    recs=extract_records(obj)
    qs=normalize_records(recs,fn[:-5],human_title(fn))
    if qs:
        sets.append({"id":fn[:-5],"title":human_title(fn),"category":cat,"questions":qs})

# Constitution memory lab
lab=load_json("constitution_memory_lab.json")
if isinstance(lab,dict):
    for key in ["multipleChoice","questions","quiz"]:
        if isinstance(lab.get(key),list):
            qs=normalize_records(lab[key],"anayasa-lab","Anayasa Ezber Lab")
            if qs:
                sets.append({"id":"anayasa-lab","title":"Anayasa Ezber Lab","category":"constitution","questions":qs})
            break

# Deduplicate exact stems inside same category
seen=set(); clean=[]
for s in sets:
    nq=[]
    for q in s["questions"]:
        k=(s["category"], re.sub(r"\s+"," ",q["stem"].lower()).strip())
        if k in seen and s["id"]=="real_exam_questions": continue
        seen.add(k); nq.append(q)
    if nq:
        s["questions"]=nq; clean.append(s)
sets=clean

meta={
 "source":"SivilSavunmaSinavPython.rar",
 "sets":len(sets),
 "questions":sum(len(s["questions"]) for s in sets),
 "note":"Veriler yüklenen PC uygulaması arşivindeki JSON kaynaklarından GitHub derlemesi sırasında oluşturuldu."
}
data={"meta":meta,"sets":sets,"subjects":subjects}
(out_www/"data.js").write_text("window.APP_DATA="+json.dumps(data,ensure_ascii=False,separators=(",",":"))+";\n",encoding="utf-8")
print(json.dumps(meta,ensure_ascii=False,indent=2))

# Keep raw study source files inside APK as well
raw_out=out_www.parent/"source_resources"
if raw_out.exists(): shutil.rmtree(raw_out)
raw_out.mkdir(parents=True)
for p in res.iterdir():
    if p.is_file() and p.suffix.lower() in {".json",".txt",".pdf",".doc"}:
        shutil.copy2(p,raw_out/p.name)
