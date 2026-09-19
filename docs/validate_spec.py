"""Validate authored curriculum, fictional evidence and generated asset declarations.

Run from any directory: python3 /path/to/project/docs/validate_spec.py
Uses Python's standard library only and never mutates project files.
"""

from datetime import date
from fractions import Fraction
import json
from pathlib import Path
import re
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "docs/fixtures/classroom.json").read_text())
checks = 0


def require(condition, message):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(message)


def rational(value):
    return Fraction(value["numerator"], value["denominator"])


def final_fraction(text):
    values = re.findall(r"\b\d+/\d+\b", text or "")
    return Fraction(values[-1]) if values else None


def unique(items, label):
    require(len(items) == len(set(items)), f"duplicate {label}")


def pair_key(operands):
    return tuple(sorted(rational(item) for item in operands))


require(DATA["fictional"] is True, "data must remain explicitly fictional")
require(DATA["fixtureUsage"]["generatedAssetsPresent"] is True, "generated sample assets are declared")
students = DATA["students"]
student_ids = [s["id"] for s in students]
require(student_ids == [f"stu-{i:02d}" for i in range(1, 9)], "roster IDs/count")
questions = DATA["questions"] + DATA["followupQuestions"] + DATA["additionalQuestions"]
by_question = {q["id"]: q for q in questions}
unique([q["id"] for q in questions], "question IDs")
require(len(questions) == 15, "expected 4 + 2 + 3 + 3 + 3 authored questions")
objectives = {item["id"]: item for item in DATA["learningObjectives"]}
criteria = {item["id"] for item in DATA["assessmentCriteria"]}

for question in questions:
    values = [rational(v) for v in question["operands"]]
    expected = Fraction(question["expectedAnswer"]["canonicalFraction"])
    require(len(values) == 2 and all(0 < v < 1 for v in values), question["id"])
    require(sum(values) == expected == rational(question["expectedAnswer"]["rational"]),
            f"answer key {question['id']}")
    require(expected <= 1, f"scope of {question['id']}")
    require(set(question["learningObjectiveIds"]) <= objectives.keys(), "objective reference")
    require(set(question["assessmentCriterionIds"]) <= criteria, "criterion reference")

material_items = [item for group in DATA["materials"].values() for item in group["prompts"]]
unique([item["id"] for item in material_items], "material prompt IDs")
require(len(material_items) == 12, "material prompt count")
for item in material_items:
    kind = item["validationKind"]
    if kind == "fraction-addition":
        expected = rational(item["expectedRational"])
        require(sum(rational(v) for v in item["operands"]) == expected, item["id"])
        require(expected == Fraction(item["canonicalFraction"]), item["id"])
    elif kind == "construct-addition":
        expected = rational(item["constructionConstraints"]["target"])
        unique([pair_key(pair) for pair in item["examplePairs"]], "construction example pairs")
        for pair in item["examplePairs"]:
            require(sum(rational(v) for v in pair) == expected, item["id"])
            require(pair[0]["denominator"] != pair[1]["denominator"], "unlike denominators")
    else:
        require(kind == "explanation" and item["expectedRational"] is None, item["id"])

prior_pairs = {pair_key(q["operands"]) for q in DATA["questions"]}
prior_pairs |= {pair_key(i["operands"]) for i in material_items if i["operands"]}
for item in material_items:
    prior_pairs |= {pair_key(pair) for pair in item.get("examplePairs", [])}
for question in DATA["followupQuestions"]:
    require(pair_key(question["operands"]) not in prior_pairs, "follow-up must use fresh pairs")

counts = {"baseline": 0, "followup": 0}
for student in students:
    for phase, question_set, expected_date in [
        ("baseline", DATA["questions"], "2026-09-22"),
        ("followup", DATA["followupQuestions"], "2026-09-24"),
    ]:
        submission = student[phase]
        require(submission["date"] == expected_date, "submission teaching date")
        require(submission["templateId"] == f"{phase}-template-v1", "template identity")
        require([r["questionId"] for r in submission["responses"]] ==
                [q["id"] for q in question_set], "exact response coverage")
        counts[phase] += len(submission["responses"])
        for response in submission["responses"]:
            value = final_fraction(response["writtenAnswer"])
            expected = Fraction(by_question[response["questionId"]]["expectedAnswer"]["canonicalFraction"])
            if phase == "baseline" and student["id"] in {"stu-01", "stu-02", "stu-03"}:
                require(value is not None and value != expected, "intended baseline error")
            elif phase == "baseline" and student["id"] != "stu-08":
                require(value == expected, "intended correct baseline answer")
            elif phase == "followup" and student["id"] == "stu-03":
                require(value is not None and value != expected, "persistent follow-up error")
            elif phase == "followup" and not (student["id"] == "stu-08" and response["questionId"] == "fq02"):
                require(value == expected, "intended correct follow-up answer")
require(counts == {"baseline": 32, "followup": 16}, "response totals")
require(students[7]["baseline"]["responses"][0]["writtenAnswer"] == "1/2 = 3/6", "incomplete evidence case")
require(all(r["writtenAnswer"] is None for r in students[7]["baseline"]["responses"][1:]), "blank baseline work")
require(students[7]["followup"]["responses"][1]["writtenAnswer"] is None, "missing follow-up evidence")
require(students[1]["followup"]["responses"][1]["writtenAnswer"].endswith("3/6 meter"), "unreduced regression case")

for template in DATA["templates"]:
    require(set(template["questionIds"]) == {r["questionId"] for r in template["questionRegions"]},
            "region coverage")
    rectangles = [r["rect"] for r in template["questionRegions"]]
    for rect in rectangles:
        require(0 <= rect["x"] < 1 and 0 <= rect["y"] < 1, "region origin")
        require(0 < rect["width"] and rect["x"] + rect["width"] <= 1, "region width")
        require(0 < rect["height"] and rect["y"] + rect["height"] <= 1, "region height")
    for index, first in enumerate(rectangles):
        for second in rectangles[index + 1:]:
            overlap = (first["x"] < second["x"] + second["width"] and
                       second["x"] < first["x"] + first["width"] and
                       first["y"] < second["y"] + second["height"] and
                       second["y"] < first["y"] + first["height"])
            require(not overlap, "overlapping question regions")

for lesson in [DATA["lesson"], DATA["nextLesson"], *DATA["additionalLessons"]]:
    require([b["id"] for b in lesson["blocks"]] == ["warmup", "model", "practice", "application", "exit"], "block IDs")
    require([b["minutes"] for b in lesson["blocks"]] == [5, 8, 12, 15, 5], "block durations")
    require(sum(b["minutes"] for b in lesson["blocks"]) == lesson["totalMinutes"] == 45, "lesson total")
require(DATA["groundTruth"]["expectedFollowupProposalLessonId"] == DATA["nextLesson"]["id"] ==
        "lesson-2026-09-25", "follow-up target")
grouping = DATA["groundTruth"]["expectedBaselineProposalAfterReview"]
placements = sum([grouping[k] for k in ["targetedStudentIds", "independentApplicationStudentIds", "extensionStudentIds"]], [])
require(sorted(placements) == student_ids, "exactly one placement per student")
require(grouping["minutes"] == 12 and grouping["concurrent"], "concurrent practice")

calendar = DATA["unitCalendar"]
by_calendar = {entry["id"]: entry for entry in calendar}
require(len(calendar) == 10 and len(by_calendar) == 10, "ten unique calendar entries")
require([entry["date"] for entry in calendar] == DATA["unit"]["availableTeachingDates"], "teaching dates")
for entry in calendar:
    require(date.fromisoformat(entry["date"]).weekday() < 5 and entry["minutes"] == 45, "weekday capacity")
    for prerequisite in entry.get("prerequisiteCalendarEntryIds", []):
        require(prerequisite in by_calendar and by_calendar[prerequisite]["date"] < entry["date"], "calendar dependency")
    require(set(entry.get("prerequisiteObjectiveIds", [])) <= objectives.keys(), "calendar objective prerequisite")
require(calendar[-1]["locked"] and calendar[-1]["date"] == "2026-10-02", "fixed assessment")
for index in [2, 3, 4]:
    require(calendar[index]["eventType"] == "planned-lesson", "unaccepted preview must remain planned")
checkpoint = calendar[3]
require(checkpoint["originalAllocation"] == {"plannedTeachingMinutes": 45, "checkpointMinutes": 0}, "original checkpoint state")
require(checkpoint["proposedAllocation"]["plannedTeachingMinutes"] +
        checkpoint["proposedAllocation"]["checkpointMinutes"] == 45, "proposed checkpoint time")
require(checkpoint["proposedAllocation"]["requiresAcceptedChange"] == "schedule_checkpoint", "checkpoint approval")

def walk_objective(key, path):
    require(key not in path, "cyclic objective prerequisite")
    for previous in objectives[key]["prerequisiteObjectiveIds"]:
        require(previous in objectives, "missing prerequisite objective")
        walk_objective(previous, path + [key])

for key in objectives:
    walk_objective(key, [])
for entry in DATA["widerCalendarPreview"]:
    require(entry["startDate"] > DATA["unit"]["endDate"], "wider calendar order")
    require(set(entry["prerequisiteCalendarEntryIds"]) <= by_calendar.keys(), "wider prerequisite")

assets = DATA["assetManifest"]["assets"]
unique([a["id"] for a in assets], "asset IDs")
unique([a["filename"] for a in assets], "asset filenames")
require(len(assets) == 59 and all(a["status"] == "generated" for a in assets), "generated asset declarations")
for student in students:
    for phase in ["baseline", "followup"]:
        require(student[phase]["assetId"] in {a["id"] for a in assets}, "submission asset reference")

assignments = DATA["assignments"]
require(len(assignments) == 5, "five assignments")
require([a["sequence"] for a in assignments] == [1, 2, 3, 4, 5], "assignment order")
require([a["date"] for a in assignments] == sorted(a["date"] for a in assignments), "dated sequence")
by_template = {t["id"]: t for t in DATA["templates"]}
lessons = {l["id"]: l for l in [DATA["lesson"], DATA["nextLesson"], *DATA["additionalLessons"]]}
for assignment in assignments:
    template = by_template[assignment["templateId"]]
    require(template["date"] == assignment["date"], "assignment/template date")
    require(assignment["targetLessonId"] in lessons, "authored target lesson")
    require(lessons[assignment["targetLessonId"]]["date"] > assignment["date"], "future lesson target")
    require(lessons[assignment["targetLessonId"]]["date"] < DATA["unit"]["fixedAssessmentDate"], "preserve assessment")
    require(1 <= assignment["eligibilityPolicy"]["extensionMinimum"] <= len(template["questionIds"]), "extension threshold")
require(all(not a["eligibilityPolicy"]["requiresPriorExtension"] for a in assignments[2:]), "later work can newly qualify")
new_totals = {"correct": 0, "incorrect": 0, "no_answer": 0}
for template_id, submissions in DATA["additionalSubmissions"].items():
    template = by_template[template_id]
    require([s["studentId"] for s in submissions] == student_ids, "complete new roster")
    for submission in submissions:
        require(submission["date"] == template["date"] and submission["templateId"] == template_id, "new submission identity")
        require(submission["assetId"] in {a["id"] for a in assets}, "new source asset")
        require(submission["recordedSupport"]["level"] in {"independent", "supported", "unknown"}, "explicit assistance")
        require([r["questionId"] for r in submission["responses"]] == template["questionIds"], "new response coverage")
        for response in submission["responses"]:
            if response["answerText"] is None:
                new_totals["no_answer"] += 1
            else:
                value = final_fraction(response["answerText"])
                require(value is not None and value == final_fraction(response["writtenAnswer"]), "final answer agrees with source working")
                expected = rational(by_question[response["questionId"]]["expectedAnswer"]["rational"])
                new_totals["correct" if value == expected else "incorrect"] += 1
            prepared = response.get("preparedExtraction")
            if prepared:
                require(prepared["legibility"] == "uncertain" and "simulated" in prepared["uncertaintyNote"], "disclosed prepared reading flag")
require(new_totals == {"correct": 61, "incorrect": 5, "no_answer": 6}, "authored additional outcomes")
require(sum(counts.values()) + sum(new_totals.values()) == 120, "120 source response slots")
used_pairs = prior_pairs | {pair_key(q["operands"]) for q in DATA["followupQuestions"]}
for question in DATA["additionalQuestions"]:
    pair = pair_key(question["operands"])
    require(pair not in used_pairs, "new assignments use fresh fraction pairs")
    used_pairs.add(pair)
require(len(DATA["fixtureUsage"]["preservedSourceHashes"]) == 16, "original scan declarations")
for asset_id, digest in DATA["fixtureUsage"]["preservedSourceHashes"].items():
    require(next(a for a in assets if a["id"] == asset_id)["sha256"] == digest, "original scan bytes preserved")
public_manifest = json.loads((ROOT / "public/demo/manifest.json").read_text())["assets"]
require([{k:v for k,v in a.items() if k != "status"} for a in assets] == public_manifest, "source/public asset declarations agree")

markdown_files = [ROOT / "README.md", ROOT / "ClassCompass-build-brief.md", *sorted((ROOT / "docs").glob("*.md"))]
local_links = 0
for path in markdown_files:
    text = path.read_text()
    for raw in re.findall(r"\[[^\]]*\]\(([^)]+)\)", text):
        target = raw.strip("<>")
        if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
            continue
        local_links += 1
        require((path.parent / unquote(target.split("#", 1)[0])).exists(), f"broken local link in {path.name}: {target}")

print(f"PASS: {checks} specification assertions; {local_links} local links.")
print("8 fictional students; 5 assignments; 40 scans; 120 responses; 15 worksheet questions; 12 practice prompts.")
print("Five lesson targets total 45 minutes each; 12-minute concurrent practice; 10 teaching days; 59 generated assets.")
print("This validates authored data and asset declarations. It does not evaluate live AI or a connected deployment.")
