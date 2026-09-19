#!/usr/bin/env python3
"""Rebuild ClassCompass's disclosed synthetic classroom assets from reviewed fixtures.

Requires Pillow and ReportLab. Fonts are bundled under public/fonts with OFL licenses.
No network, API keys, or model calls. All output is deterministic.
"""
from pathlib import Path
import hashlib
import io
import json
import random
import re

from PIL import Image, ImageDraw, ImageFont
import reportlab
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'demo'
FONTS = ROOT / 'public' / 'fonts'
QA = ROOT / 'tmp' / 'pdfs'
SOURCE = json.loads((ROOT / 'docs' / 'fixtures' / 'classroom.json').read_text())
W, H = 1700, 2200
TEAL = '#205F56'
INK = '#263C39'
MUTED = '#60716A'
PAPER = '#FFFEFA'
LINE = '#DCE5DE'
ASSETS = []
EXTRACTIONS = {}
QUESTION_MAP = {q['id']: q for q in SOURCE['questions'] + SOURCE['followupQuestions']}


def clean(text):
    return str(text).replace('\u2013', '-').replace('\u2014', '-').replace('\u2026', '...')


def font(size, hand=False, weight=500):
    f = ImageFont.truetype(str(FONTS / ('Caveat-Variable.ttf' if hand else 'Nunito-Variable.ttf')), size)
    f.set_variation_by_axes([weight])
    return f


def lines_for(text, f, max_width):
    lines = []
    for paragraph in clean(text).split('\n'):
        line = ''
        for word in paragraph.split():
            test = f'{line} {word}'.strip()
            if f.getlength(test) > max_width and line:
                lines.append(line)
                line = word
            else:
                line = test
        lines.append(line)
    return lines


def text_lines(draw, text, x, y, f, width, fill=INK, line_height=None):
    lh = line_height or round(f.size * 1.3)
    lines = lines_for(text, f, width)
    for line in lines:
        draw.text((x, y), line, font=f, fill=fill)
        y += lh
    return y


def template_page(template, student=None):
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((102, 46, 154, 98), radius=15, fill=TEAL)
    d.text((115, 44), '+', font=font(48, weight=700), fill='white')
    d.text((176, 49), 'ClassCompass  /  Grade 5 mathematics', font=font(29, weight=700), fill=TEAL)
    d.text((102, 106), template['title'], font=font(51, weight=800), fill=INK)
    who = f"{student['displayName']}  ({student['id']})" if student else '_' * 30
    d.text((102, 175), f"Name: {who}", font=font(28), fill=INK)
    d.text((1130, 175), f"Date: {template['date']}", font=font(28), fill=INK)
    text_lines(d, template['instructions'], 102, 224, font(26), 1496, line_height=32)
    d.text((102, H - 49), 'SYNTHETIC FICTIONAL DEMO - no real student data', font=font(23, weight=700), fill=MUTED)
    d.text((1200, H - 49), template['id'], font=font(21), fill=MUTED)
    response_boxes = {}
    for i, r in enumerate(template['questionRegions'], 1):
        a = r['rect']
        x, y, rw, rh = (round(a['x']*W), round(a['y']*H), round(a['width']*W), round(a['height']*H))
        d.rounded_rectangle((x, y, x+rw, y+rh), radius=16, fill='#FFFFFF', outline=LINE, width=2)
        d.rounded_rectangle((x+19, y+20, x+74, y+74), radius=13, fill='#ECF3EF')
        d.text((x+35, y+21), str(i), font=font(34, weight=800), fill=TEAL)
        end = text_lines(d, QUESTION_MAP[r['questionId']]['prompt'], x+98, y+20, font(32, weight=650), rw-127, line_height=41)
        sy = max(end+16, y+108)
        for ly in range(sy+66, y+rh-13, 67):
            d.line((x+29, ly, x+rw-29, ly), fill='#EDF0EB', width=2)
        response_boxes[r['questionId']] = (x+35, sy, rw-70, y+rh-sy-24)
    return im, response_boxes


def write_handwriting(im, text, box, student_number, question_number):
    if text is None:
        return
    x, y, width, height = box
    rng = random.Random(student_number * 100 + question_number)
    text = clean(text).replace('; ', ';\n')
    # Put the explanation on its own line, retaining every authored word.
    text = text.replace('. I added', '.\nI added').replace('. Both fractions', '.\nBoth fractions')
    size = [53, 55, 54, 51, 50, 54, 52, 55][student_number-1]
    while True:
        f = font(size, hand=True, weight=450+student_number*23)
        lines = lines_for(text, f, width-18)
        lh = round(size*1.20)
        if len(lines)*lh <= height or size <= 37:
            break
        size -= 1
    if len(lines)*lh > height:
        raise ValueError(f'Handwriting does not fit {text}')
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        px, py = x+rng.randint(1, 8), y+i*lh+rng.randint(-2, 3)
        # Seeded small per-character offsets suggest writing while preserving clear glyphs.
        for char in line:
            d.text((px, py+rng.choice([-1, 0, 0, 1])), char, font=f, fill='#334759')
            px += f.getlength(char)
        if px > x+width+1:
            raise ValueError('Handwriting overflow')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def asset(asset_id, filename, kind, template_id=None, student_id=None):
    row = {'id': asset_id, 'filename': filename, 'sha256': sha(OUT/filename), 'type': kind}
    if template_id:
        row['templateId'] = template_id
    if student_id:
        row['studentId'] = student_id
    ASSETS.append(row)
    return row['sha256']


def image_pdf(im, filename):
    c = canvas.Canvas(str(OUT/filename), pagesize=(612, 792), invariant=1)
    c.setTitle(filename.replace('.pdf', '').replace('-', ' '))
    c.setAuthor('ClassCompass fictional demonstration')
    c.drawImage(ImageReader(im), 0, 0, 612, 792)
    c.showPage()
    c.save()


BASELINE_FINAL = [
    ['2/5','3/7','1/5','1/3 meter'],
    ['2/5','3/7','3/15','4/12 meter'],
    ['2/5','3/7','3/15','4/12 meter'],
    ['5/6','11/12','1/2','5/8 meter'],
    ['5/6','11/12','1/2','5/8 meter'],
    ['5/6','11/12','1/2','5/8 meter'],
    ['5/6','11/12','1/2','5/8 meter'],
    [None,None,None,None],
]
FOLLOWUP_FINAL = [
    ['7/12','1/2 meter'],['7/12','3/6 meter'],['2/7','2/9 meter'],
    ['7/12','1/2 meter'],['7/12','1/2 meter'],['7/12','1/2 meter'],
    ['7/12','1/2 meter'],['7/12',None],
]


def make_worksheets():
    for template, stage, answers in zip(SOURCE['templates'], ['baseline','followup'], [BASELINE_FINAL,FOLLOWUP_FINAL]):
        blank, _ = template_page(template)
        filename = template['id']+'.pdf'
        image_pdf(blank, filename)
        asset(stage+'-blank', filename, 'blank-template', template['id'])
        blank.save(QA/(stage+'-blank.png'))
        for n, student in enumerate(SOURCE['students'], 1):
            im, boxes = template_page(template, student)
            responses = []
            for i, r in enumerate(student[stage]['responses']):
                text = r['writtenAnswer']
                write_handwriting(im, text, boxes[r['questionId']], n, i)
                extraction = {'questionId': r['questionId'], 'workingText': text or '', 'answerText': answers[n-1][i], 'legibility': 'blank' if text is None else 'clear', 'alternatives': [], 'uncertaintyNote': None}
                if stage == 'baseline' and student['id'] == 'stu-06' and r['questionId'] == 'q-03':
                    extraction.update(workingText=text[:-3]+'1/5', answerText='1/5', legibility='uncertain', alternatives=['1/2'], uncertaintyNote='Prepared correction example: simulated final-denominator misread. The source image contains 1/2; inspect the image and the preceding 5/10 step.')
                responses.append(extraction)
            filename = f"{stage}-{student['id']}.png"
            im.save(OUT/filename, optimize=True)
            digest = asset(f"{stage}-{student['id']}", filename, 'fictional-handwritten-scan', template['id'], student['id'])
            record = {'templateId': template['id'], 'studentId': student['id'], 'responses': responses}
            if stage == 'baseline' and student['id'] == 'stu-06':
                record['preparedCorrection'] = 'Prepared correction example - simulated extraction error. Actual image answer is 1/2; fixture transcript deliberately reads 1/5.'
            EXTRACTIONS[digest] = record


def register_pdf_fonts():
    # ReportLab reads the default outlines from the variable font; weight use is visual only.
    pdfmetrics.registerFont(TTFont('Nunito', str(FONTS/'Nunito-Variable.ttf')))
    pdfmetrics.registerFont(TTFont('PrintBody', str(Path(reportlab.__file__).parent/'fonts'/'Vera.ttf')))
    pdfmetrics.registerFont(TTFont('PrintHeading', str(Path(reportlab.__file__).parent/'fonts'/'VeraBd.ttf')))


def pdf_text(c, text, x, top, width, size=11, leading=15, color=INK):
    words = clean(text).split()
    face = 'PrintHeading' if size >= 12 else 'PrintBody'
    lines, current = [], ''
    for word in words:
        test = f'{current} {word}'.strip()
        if pdfmetrics.stringWidth(test, face, size) > width and current:
            lines.append(current)
            current = word
        else:
            current = test
    if current:
        lines.append(current)
    c.setFont(face, size)
    c.setFillColor(HexColor(color))
    for line in lines:
        c.drawString(x, 792-top-size, line)
        top += leading
    return top


def pdf_header(c, title, kicker, subtitle='', page=1):
    c.setFillColor(HexColor(TEAL))
    c.roundRect(38, 738, 22, 22, 6, fill=1, stroke=0)
    c.setFillColor(HexColor('#FFFFFF'))
    c.setFont('Nunito', 20)
    c.drawCentredString(49, 741, '+')
    pdf_text(c, 'ClassCompass  /  '+kicker, 70, 34, 500, 10, 13, TEAL)
    end = pdf_text(c, title, 38, 77, 538, 23, 27)
    if subtitle:
        end = pdf_text(c, subtitle, 38, end+7, 538, 10.5, 14, MUTED)
    c.setStrokeColor(HexColor(LINE))
    c.line(38, 43, 574, 43)
    pdf_text(c, 'FICTIONAL DEMO MATERIALS  |  Grade 5 fraction addition', 38, 755, 475, 8, 11, MUTED)
    pdf_text(c, str(page), 562, 755, 12, 8, 11, MUTED)
    return end+20


def new_pdf(filename, title):
    c = canvas.Canvas(str(OUT/filename), pagesize=(612,792), invariant=1)
    c.setTitle(title)
    c.setAuthor('ClassCompass fictional demonstration')
    return c


def lesson_json(lesson):
    return {'schemaVersion':1, 'lessonId':lesson['id'], 'unitId':lesson['unitId'], 'date':lesson['date'], 'title':lesson['title'], 'objectiveIds':SOURCE['unit']['learningObjectiveIds'], 'totalMinutes':45, 'blocks':[{'id':b['id'], 'title':b['title'], 'minutes':b['minutes'], 'instructions':b['content'], 'mode':'whole_class'} for b in lesson['blocks']]}


def make_lessons():
    for lesson in [SOURCE['lesson'], SOURCE['nextLesson']]:
        filename = lesson['id']+'-original.json'
        (OUT/filename).write_text(json.dumps(lesson_json(lesson), indent=2)+'\n')
        asset(lesson['id']+'-json', filename, 'teacher-plan-import')
    lesson = SOURCE['lesson']
    filename = lesson['id']+'-original.pdf'
    c = new_pdf(filename, lesson['title'])
    y = pdf_header(c, lesson['title'], 'Original teacher lesson', 'September 23, 2026  |  Grade 5  |  45 minutes')
    y = pdf_text(c, 'Learning focus', 38, y+5, 540, 12, 17, TEAL)
    y = pdf_text(c, 'Use equivalent fractions to add unlike denominators. Explain the total in a word problem using working and units.', 38, y+5, 538, 11, 15)
    y += 21
    elapsed = 0
    for b in lesson['blocks']:
        c.setFillColor(HexColor('#F1F5F0'))
        c.roundRect(38, 792-y-79, 536, 79, 7, fill=1, stroke=0)
        pdf_text(c, f"{elapsed:02d}-{elapsed+b['minutes']:02d} min", 49, y+11, 72, 10, 14, TEAL)
        pdf_text(c, b['title'], 130, y+10, 425, 13, 17)
        pdf_text(c, b['content'], 130, y+32, 425, 10, 13)
        y += 91
        elapsed += b['minutes']
    pdf_text(c, 'Planning note: Review September 22 work before finalizing practice. The assessment remains fixed on October 2.', 38, y+2, 538, 10, 14, MUTED)
    c.showPage(); c.save()
    asset('lesson-original', filename, 'teacher-plan')


def ruled_space(c, top, bottom, x=54, width=500):
    c.setStrokeColor(HexColor(LINE)); c.setLineWidth(.55)
    for y in range(int(top), int(bottom), 24):
        c.line(x,792-y,x+width,792-y)


def strip(c,x,top,width,parts):
    c.setStrokeColor(HexColor('#768B81')); c.setLineWidth(.8)
    c.rect(x,792-top-22,width,22,stroke=1,fill=0)
    for n in range(1,parts):
        xx=x+width*n/parts
        c.line(xx,792-top,xx,792-top-22)


def make_materials():
    for key in ['targeted','extension','exit']:
        m = SOURCE['materials'][key]
        filename = m['id']+'.pdf'
        c = new_pdf(filename,m['title'])
        y = pdf_header(c,m['title'],'Practice page',f"Name: _________________________    Date: __________    {m['suggestedMinutes']} minutes")
        y = pdf_text(c,'Show your thinking with calculations, words, or labeled models. Use the same-sized whole in every fraction model.',38,y,538,10,14,MUTED)+12
        count = len(m['prompts'])
        bottom = 723
        cell = (bottom-y)/count
        for i,p in enumerate(m['prompts']):
            top = y+i*cell
            end = pdf_text(c,f"{i+1}. {p['prompt']}",38,top,536,11,15)
            if key == 'targeted' and i in [0,1]:
                # Equal-length blank and partitioned bars make the intended common units tangible.
                parts = 4 if i==0 else 10
                strip(c,54,end+13,490,1)
                strip(c,54,end+46,490,parts)
                ruled_space(c,end+106,top+cell-9)
            else:
                ruled_space(c,end+32,top+cell-7)
        c.showPage();c.save()
        asset('material-'+key,filename,'printable-activity')


def make_teacher_key():
    filename='classcompass-teacher-answer-keys.pdf'
    c=new_pdf(filename,'Teacher answer keys')
    groups=[('Baseline: show your thinking',SOURCE['questions']),('Targeted: equal parts before adding',SOURCE['materials']['targeted']['prompts']),('Independent entry check',SOURCE['materials']['independentEntryCheck']['prompts']),('Independent application',SOURCE['materials']['independentApplication']['prompts']),('Extension: two methods, one value',SOURCE['materials']['extension']['prompts']),('Lesson exit ticket',SOURCE['materials']['exit']['prompts']),('Follow-up: a fresh fraction check',SOURCE['followupQuestions'])]
    page=1
    y=pdf_header(c,'Teacher answer keys','Teacher copy','Keep separate from student practice pages.',page)
    y=pdf_text(c,'Accept equivalent unreduced answers and valid nonleast common denominators. Numerical correctness, written method, and help provided are separate observations.',38,y,538,10.5,15)+14
    for title,questions in groups:
        required = 28+sum(16+len(lines_for(q.get('answerKey') or '; '.join(q['answerWorking']),font(30),1465))*15 for q in questions)
        # Conservative page break uses text lengths and a fixed bottom margin.
        if y+required>715:
            c.showPage();page+=1
            y=pdf_header(c,'Teacher answer keys','Teacher copy','Continued',page)
        y=pdf_text(c,title,38,y+7,538,13,18,TEAL)+6
        for i,q in enumerate(questions,1):
            key=q.get('answerKey') or '; '.join(q['answerWorking'])
            y=pdf_text(c,f"{i}. {key}",46,y,523,10.5,15)+7
        y+=8
    if y+74>715:
        c.showPage();page+=1;y=pdf_header(c,'Teacher notes','Teacher copy','',page)
    y=pdf_text(c,'Support and interpretation',38,y,538,13,18,TEAL)+6
    pdf_text(c,'Record hints and worked examples as support. A blank response means there is not enough evidence yet. The source worksheets and this answer key are synthetic fictional examples; teacher review remains required.',38,y,538,10.5,15)
    c.showPage();c.save()
    asset('teacher-answer-keys',filename,'answer-key')


def contacts():
    scans=[a for a in ASSETS if a['type']=='fictional-handwritten-scan']
    # Order baseline row before follow-up row for convenient scenario inspection.
    for stage in ['baseline','followup']:
        sheet=Image.new('RGB',(4*425,2*575),'#EAF0EA')
        d=ImageDraw.Draw(sheet)
        for i,a in enumerate([x for x in scans if x['id'].startswith(stage)]):
            thumb=Image.open(OUT/a['filename']).resize((400,518))
            x=(i%4)*425+12;y=(i//4)*575+38
            sheet.paste(thumb,(x,y))
            d.text((x,y-30),a['id'],font=font(22,weight=700),fill=INK)
        sheet.save(QA/(stage+'-contact.png'))


def verify():
    assert len(EXTRACTIONS)==16
    assert sum(len(v['responses']) for v in EXTRACTIONS.values())==48
    for a in ASSETS:
        assert sha(OUT/a['filename']) == a['sha256']
        if a['filename'].endswith('.png'):
            assert Image.open(OUT/a['filename']).size == (W,H)
    assert all(set(a)<= {'id','filename','studentId','templateId','sha256','type'} for a in ASSETS)
    finley=next(v for v in EXTRACTIONS.values() if v['studentId']=='stu-06' and v['templateId']=='baseline-template-v1')
    assert finley['responses'][2]['answerText']=='1/5'
    assert SOURCE['students'][5]['baseline']['responses'][2]['writtenAnswer'].endswith('1/2')


def main():
    OUT.mkdir(parents=True,exist_ok=True);QA.mkdir(parents=True,exist_ok=True)
    (ROOT/'lib'/'fixtures').mkdir(parents=True,exist_ok=True)
    register_pdf_fonts()
    make_worksheets();make_lessons();make_materials();make_teacher_key();contacts();verify()
    (OUT/'manifest.json').write_text(json.dumps({'assets':ASSETS},indent=2)+'\n')
    (ROOT/'lib'/'fixtures'/'extractions.json').write_text(json.dumps(EXTRACTIONS,indent=2)+'\n')
    print(f'Generated {len(ASSETS)} assets; {len(EXTRACTIONS)} scans; 48 server-only reference response records.')
    print('QA images: tmp/pdfs/baseline-contact.png and tmp/pdfs/followup-contact.png')

if __name__=='__main__':
    main()
