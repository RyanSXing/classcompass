// Public authored curriculum only. No reference student writing or scenario ground truth.
import type { LessonSnapshot, Material } from "./contracts";
const authored = {
  "classroom": {
    "id": "class-grade5-demo",
    "name": "Grade 5 \u00b7 Fraction addition",
    "studentCount": 8,
    "subject": "Mathematics",
    "grade": 5
  },
  "unit": {
    "id": "unit-fractions-v1",
    "title": "Adding fractions with unlike denominators",
    "startDate": "2026-09-21",
    "endDate": "2026-10-02",
    "fixedAssessmentDate": "2026-10-02",
    "availableTeachingDates": [
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02"
    ],
    "lessonMinutes": 45,
    "scope": "Positive proper fractions, unlike denominators, sums at most one; no mixed numbers.",
    "learningObjectiveIds": [
      "obj-equivalent-fractions",
      "obj-add-unlike-fractions",
      "obj-explain-fraction-context"
    ],
    "prerequisiteUnitIds": [],
    "prerequisiteRule": "Prerequisites describe planned curriculum exposure and within-lesson content order, not permanent student mastery. Preserve the authored unit sequence; targeted support may revisit prerequisites inside a concurrent block."
  },
  "objectives": [
    {
      "id": "obj-equivalent-fractions",
      "description": "Represent equivalent fractions as the same quantity using equal-sized wholes.",
      "prerequisiteObjectiveIds": []
    },
    {
      "id": "obj-add-unlike-fractions",
      "description": "Add fractions with unlike denominators by rewriting them in a common fractional unit.",
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions"
      ]
    },
    {
      "id": "obj-explain-fraction-context",
      "description": "Explain a fraction-addition word problem with working, a reasonable total, and appropriate units.",
      "prerequisiteObjectiveIds": [
        "obj-add-unlike-fractions"
      ]
    }
  ],
  "criteria": [
    {
      "id": "crit-equivalence",
      "description": "Rewrite fractions without changing their values; fraction models must use equal-sized wholes."
    },
    {
      "id": "crit-common-unit",
      "description": "Express addends in a common fractional unit before adding."
    },
    {
      "id": "crit-addition",
      "description": "Add numerators and retain the common denominator; accept mathematically equivalent unreduced answers."
    },
    {
      "id": "crit-reasoning",
      "description": "Show enough calculation steps, a labeled model, or a clear explanation to inspect the method."
    },
    {
      "id": "crit-context",
      "description": "For word problems, interpret the total with the stated unit."
    }
  ],
  "questions": [
    {
      "id": "q-01",
      "prompt": "Calculate 1/2 + 1/3. Show how you make equal-sized parts before adding.",
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "assessmentCriterionIds": [
        "crit-equivalence",
        "crit-common-unit",
        "crit-addition",
        "crit-reasoning"
      ],
      "taskDifficulty": "core",
      "expectedAnswer": {
        "canonicalFraction": "5/6",
        "acceptEquivalentUnreducedFractions": true,
        "rational": {
          "numerator": 5,
          "denominator": 6
        }
      },
      "answerWorking": [
        "1/2 = 3/6",
        "1/3 = 2/6",
        "3/6 + 2/6 = 5/6"
      ],
      "validationKind": "fraction-addition",
      "operands": [
        {
          "numerator": 1,
          "denominator": 2
        },
        {
          "numerator": 1,
          "denominator": 3
        }
      ],
      "answerUnit": null
    },
    {
      "id": "q-02",
      "prompt": "Calculate 1/4 + 2/3. Show your equivalent fractions and the sum.",
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "assessmentCriterionIds": [
        "crit-equivalence",
        "crit-common-unit",
        "crit-addition",
        "crit-reasoning"
      ],
      "taskDifficulty": "core",
      "expectedAnswer": {
        "canonicalFraction": "11/12",
        "acceptEquivalentUnreducedFractions": true,
        "rational": {
          "numerator": 11,
          "denominator": 12
        }
      },
      "answerWorking": [
        "1/4 = 3/12",
        "2/3 = 8/12",
        "3/12 + 8/12 = 11/12"
      ],
      "validationKind": "fraction-addition",
      "operands": [
        {
          "numerator": 1,
          "denominator": 4
        },
        {
          "numerator": 2,
          "denominator": 3
        }
      ],
      "answerUnit": null
    },
    {
      "id": "q-03",
      "prompt": "Calculate 2/5 + 1/10. Show your steps. You may simplify your answer.",
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "assessmentCriterionIds": [
        "crit-equivalence",
        "crit-common-unit",
        "crit-addition",
        "crit-reasoning"
      ],
      "taskDifficulty": "core",
      "expectedAnswer": {
        "canonicalFraction": "1/2",
        "acceptEquivalentUnreducedFractions": true,
        "rational": {
          "numerator": 1,
          "denominator": 2
        }
      },
      "answerWorking": [
        "2/5 = 4/10",
        "4/10 + 1/10 = 5/10",
        "5/10 = 1/2"
      ],
      "validationKind": "fraction-addition",
      "operands": [
        {
          "numerator": 2,
          "denominator": 5
        },
        {
          "numerator": 1,
          "denominator": 10
        }
      ],
      "answerUnit": null
    },
    {
      "id": "q-04",
      "prompt": "A class uses 3/8 meter of ribbon for one display and 1/4 meter for another. How many meters of ribbon does it use altogether? Show your working and include the unit.",
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "assessmentCriterionIds": [
        "crit-equivalence",
        "crit-common-unit",
        "crit-addition",
        "crit-reasoning",
        "crit-context"
      ],
      "taskDifficulty": "core-transfer",
      "expectedAnswer": {
        "canonicalFraction": "5/8",
        "acceptEquivalentUnreducedFractions": true,
        "rational": {
          "numerator": 5,
          "denominator": 8
        }
      },
      "answerWorking": [
        "1/4 = 2/8",
        "3/8 + 2/8 = 5/8",
        "The class uses 5/8 meter altogether."
      ],
      "validationKind": "fraction-addition",
      "operands": [
        {
          "numerator": 3,
          "denominator": 8
        },
        {
          "numerator": 1,
          "denominator": 4
        }
      ],
      "answerUnit": "meter"
    },
    {
      "id": "fq01",
      "prompt": "Calculate 1/3 + 1/4. Show equivalent fractions or an equal-whole model that explains your answer.",
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "assessmentCriterionIds": [
        "crit-equivalence",
        "crit-common-unit",
        "crit-addition",
        "crit-reasoning"
      ],
      "taskDifficulty": "core",
      "expectedAnswer": {
        "canonicalFraction": "7/12",
        "acceptEquivalentUnreducedFractions": true,
        "rational": {
          "numerator": 7,
          "denominator": 12
        }
      },
      "answerWorking": [
        "1/3 = 4/12",
        "1/4 = 3/12",
        "4/12 + 3/12 = 7/12"
      ],
      "validationKind": "fraction-addition",
      "operands": [
        {
          "numerator": 1,
          "denominator": 3
        },
        {
          "numerator": 1,
          "denominator": 4
        }
      ],
      "answerUnit": null
    },
    {
      "id": "fq02",
      "prompt": "Jules uses 1/6 meter of ribbon for one tag and 1/3 meter for another. How much ribbon is used altogether? Show your working and include the unit.",
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "assessmentCriterionIds": [
        "crit-equivalence",
        "crit-common-unit",
        "crit-addition",
        "crit-reasoning",
        "crit-context"
      ],
      "taskDifficulty": "core-transfer",
      "expectedAnswer": {
        "canonicalFraction": "1/2",
        "acceptEquivalentUnreducedFractions": true,
        "rational": {
          "numerator": 1,
          "denominator": 2
        }
      },
      "answerWorking": [
        "1/3 = 2/6",
        "1/6 + 2/6 = 3/6",
        "3/6 = 1/2",
        "Jules uses 1/2 meter altogether."
      ],
      "validationKind": "fraction-addition",
      "operands": [
        {
          "numerator": 1,
          "denominator": 6
        },
        {
          "numerator": 1,
          "denominator": 3
        }
      ],
      "answerUnit": "meter"
    }
  ],
  "templates": [
    {
      "id": "baseline-template-v1",
      "title": "Fraction addition: show your thinking",
      "date": "2026-09-22",
      "questionIds": [
        "q-01",
        "q-02",
        "q-03",
        "q-04"
      ],
      "instructions": "Show calculation steps or a labeled model. Use the same-sized whole in every model. You may leave a correct answer unreduced. If you are unsure, show what you can do. Teacher records any help provided.",
      "pageSize": "US-Letter",
      "questionRegions": [
        {
          "questionId": "q-01",
          "rect": {
            "x": 0.06,
            "y": 0.14,
            "width": 0.88,
            "height": 0.19
          }
        },
        {
          "questionId": "q-02",
          "rect": {
            "x": 0.06,
            "y": 0.35,
            "width": 0.88,
            "height": 0.19
          }
        },
        {
          "questionId": "q-03",
          "rect": {
            "x": 0.06,
            "y": 0.56,
            "width": 0.88,
            "height": 0.19
          }
        },
        {
          "questionId": "q-04",
          "rect": {
            "x": 0.06,
            "y": 0.77,
            "width": 0.88,
            "height": 0.19
          }
        }
      ]
    },
    {
      "id": "followup-template-v1",
      "title": "A fresh fraction check",
      "date": "2026-09-24",
      "questionIds": [
        "fq01",
        "fq02"
      ],
      "instructions": "Complete both questions independently. Show your working and include the unit in the word problem. Teacher records any assistance rather than prompting answers.",
      "pageSize": "US-Letter",
      "questionRegions": [
        {
          "questionId": "fq01",
          "rect": {
            "x": 0.06,
            "y": 0.18,
            "width": 0.88,
            "height": 0.32
          }
        },
        {
          "questionId": "fq02",
          "rect": {
            "x": 0.06,
            "y": 0.55,
            "width": 0.88,
            "height": 0.38
          }
        }
      ]
    }
  ],
  "roster": [
    {
      "id": "stu-01",
      "displayName": "Avery"
    },
    {
      "id": "stu-02",
      "displayName": "Blake"
    },
    {
      "id": "stu-03",
      "displayName": "Casey"
    },
    {
      "id": "stu-04",
      "displayName": "Devon"
    },
    {
      "id": "stu-05",
      "displayName": "Emery"
    },
    {
      "id": "stu-06",
      "displayName": "Finley"
    },
    {
      "id": "stu-07",
      "displayName": "Gray"
    },
    {
      "id": "stu-08",
      "displayName": "Harper"
    }
  ],
  "lessons": [
    {
      "schemaVersion": 1,
      "lessonId": "lesson-2026-09-23",
      "unitId": "unit-fractions-v1",
      "date": "2026-09-23",
      "title": "Apply fraction addition to word problems",
      "objectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "totalMinutes": 45,
      "blocks": [
        {
          "id": "warmup",
          "title": "Recall equivalent fractions",
          "minutes": 5,
          "instructions": "Use an equal-whole model to connect 1/2 and 2/4, then explain why both have the same value.",
          "mode": "whole_class"
        },
        {
          "id": "model",
          "title": "Model a word problem",
          "minutes": 8,
          "instructions": "Teacher models a new fraction-addition context using common-sized parts, adds, and checks the total against one whole.",
          "mode": "whole_class"
        },
        {
          "id": "practice",
          "title": "General paired practice",
          "minutes": 12,
          "instructions": "All students complete the same two unlike-denominator fraction word problems in pairs.",
          "mode": "whole_class"
        },
        {
          "id": "application",
          "title": "Apply to word problems",
          "minutes": 15,
          "instructions": "Students solve and explain fraction-addition contexts; the teacher circulates and records observations.",
          "mode": "whole_class"
        },
        {
          "id": "exit",
          "title": "Explain an addition method",
          "minutes": 5,
          "instructions": "Students explain why equivalent fractions are needed and complete a short exit check.",
          "mode": "whole_class"
        }
      ]
    },
    {
      "schemaVersion": 1,
      "lessonId": "lesson-2026-09-25",
      "unitId": "unit-fractions-v1",
      "date": "2026-09-25",
      "title": "Compare strategies and check reasonableness",
      "objectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "totalMinutes": 45,
      "blocks": [
        {
          "id": "warmup",
          "title": "Compare equivalent totals",
          "minutes": 5,
          "instructions": "Recognize that 3/6 and 1/2 name the same amount and explain why.",
          "mode": "whole_class"
        },
        {
          "id": "model",
          "title": "Compare two valid methods",
          "minutes": 8,
          "instructions": "Teacher models unlike-denominator addition with two common denominators and checks the total against the addends and one whole.",
          "mode": "whole_class"
        },
        {
          "id": "practice",
          "title": "Ordinary paired strategy practice",
          "minutes": 12,
          "instructions": "All pairs solve two new fraction-addition calculations, compare methods, and justify whether each answer is reasonable.",
          "mode": "whole_class"
        },
        {
          "id": "application",
          "title": "Apply and explain",
          "minutes": 15,
          "instructions": "Students solve fresh fraction-addition word problems and explain one method to a partner while the teacher circulates.",
          "mode": "whole_class"
        },
        {
          "id": "exit",
          "title": "Independent explanation",
          "minutes": 5,
          "instructions": "Students complete a fresh sum and explain how they know the answer is reasonable.",
          "mode": "whole_class"
        }
      ]
    }
  ],
  "calendar": [
    {
      "date": "2026-09-21",
      "title": "Equivalent fractions with equal wholes",
      "content": "Represent equal values using fraction strips and drawings.",
      "eventType": "none",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions"
      ],
      "id": "calendar-2026-09-21",
      "prerequisiteCalendarEntryIds": [],
      "prerequisiteObjectiveIds": [],
      "objectiveSequence": [
        "obj-equivalent-fractions"
      ]
    },
    {
      "date": "2026-09-22",
      "title": "Add unlike denominators and collect baseline",
      "content": "Teach common fractional units; collect baseline-template-v1 independently.",
      "eventType": "baseline",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-09-22",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-21"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-09-23",
      "title": "Apply fraction addition to word problems",
      "content": "Original 45-minute application lesson with a shared 12-minute paired-practice block. Targeted support appears only as a proposal until the teacher applies it.",
      "eventType": "planned-lesson",
      "lessonId": "lesson-2026-09-23",
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "proposalEventType": "targeted-support",
      "id": "calendar-2026-09-23",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-09-24",
      "title": "Fraction-addition application and explanation",
      "content": "Original 45-minute application and explanation lesson. The proposed independent follow-up occupies the first eight minutes only if its schedule_checkpoint change is accepted; otherwise ordinary teaching remains 45 minutes.",
      "eventType": "planned-lesson",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-09-24",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "proposalEventType": "followup",
      "checkpointMinutes": 8,
      "originalAllocation": {
        "plannedTeachingMinutes": 45,
        "checkpointMinutes": 0
      },
      "proposedAllocation": {
        "plannedTeachingMinutes": 37,
        "checkpointMinutes": 8,
        "checkpointOffsetMinutes": 0,
        "checkpointTemplateId": "followup-template-v1",
        "requiresAcceptedChange": "schedule_checkpoint"
      },
      "allocationRule": "originalAllocation remains the accepted schedule until the checkpoint change is applied; proposedAllocation is a preview, not an accepted snapshot. Derive the accepted 37+8 snapshot only on application."
    },
    {
      "date": "2026-09-25",
      "title": "Compare strategies and check reasonableness",
      "content": "Original 45-minute lesson comparing strategies and checking reasonableness. Any targeted revisit depends on reviewed follow-up evidence and a separately accepted proposal.",
      "eventType": "planned-lesson",
      "lessonId": "lesson-2026-09-25",
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "proposalEventType": "targeted-revisit",
      "id": "calendar-2026-09-25",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-09-28",
      "title": "Connect models to written methods",
      "content": "Continue unlike-denominator addition with equal-whole models and calculation explanations.",
      "eventType": "none",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-09-28",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-09-29",
      "title": "Select and justify a common denominator",
      "content": "Compare valid denominators and accept equivalent unreduced sums.",
      "eventType": "none",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-09-29",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-09-30",
      "title": "Explain fraction-addition contexts",
      "content": "Use fresh word problems and units; collect additional observations where needed.",
      "eventType": "none",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-09-30",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-10-01",
      "title": "Review and short conferences",
      "content": "Review required objectives; use brief checks to address unresolved evidence.",
      "eventType": "review",
      "lessonId": null,
      "minutes": 45,
      "locked": false,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-10-01",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-22"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    },
    {
      "date": "2026-10-02",
      "title": "Fixed unit assessment",
      "content": "Assess the unit objectives; date is locked.",
      "eventType": "assessment",
      "lessonId": null,
      "minutes": 45,
      "locked": true,
      "learningObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "id": "calendar-2026-10-02",
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-09-30"
      ],
      "prerequisiteObjectiveIds": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ],
      "objectiveSequence": [
        "obj-equivalent-fractions",
        "obj-add-unlike-fractions",
        "obj-explain-fraction-context"
      ]
    }
  ],
  "widerCalendar": [
    {
      "startDate": "2026-10-05",
      "endDate": "2026-10-09",
      "title": "Next planned unit",
      "locked": false,
      "detail": "Placeholder for a teacher-provided next unit; no exact curriculum topic is assumed. The proposed in-block support preserves this window; applying support still requires teacher approval.",
      "id": "calendar-next-unit-preview",
      "learningObjectiveIds": [],
      "prerequisiteObjectiveIds": [],
      "prerequisiteUnitIds": [
        "unit-fractions-v1"
      ],
      "prerequisiteCalendarEntryIds": [
        "calendar-2026-10-02"
      ],
      "prerequisiteRule": "Preserve placement after the current unit assessment. The next-unit topic and skill prerequisites are not yet specified; this is a scheduling dependency only."
    }
  ],
  "materials": [
    {
      "id": "targeted-equal-parts-v1",
      "title": "Equal parts before adding",
      "suggestedMinutes": 12,
      "teacherLed": true,
      "prompts": [
        {
          "id": "target-01",
          "prompt": "Use two equal-length fraction strips. Shade 1/2 on one and 1/4 on the other. Rename the halves as fourths, then find 1/2 + 1/4.",
          "canonicalFraction": "3/4",
          "answerKey": "1/2 = 2/4; 2/4 + 1/4 = 3/4. The strips must represent the same-sized whole.",
          "expectedRational": {
            "numerator": 3,
            "denominator": 4
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 2
            },
            {
              "numerator": 1,
              "denominator": 4
            }
          ]
        },
        {
          "id": "target-02",
          "prompt": "Draw or use equal-length strips to solve 1/5 + 1/10. Label the equal-sized parts and write the matching calculation.",
          "canonicalFraction": "3/10",
          "answerKey": "1/5 = 2/10; 2/10 + 1/10 = 3/10.",
          "expectedRational": {
            "numerator": 3,
            "denominator": 10
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 5
            },
            {
              "numerator": 1,
              "denominator": 10
            }
          ]
        },
        {
          "id": "target-03",
          "prompt": "A fictional student says 1/2 + 1/4 = 2/6 because they added both tops and bottoms. Explain what needs to change, then write a correct calculation.",
          "canonicalFraction": "3/4",
          "answerKey": "Halves and fourths are different-sized parts. Rename 1/2 as 2/4 and add 2/4 + 1/4 = 3/4. The answer 2/6 is smaller than 1/2, so it cannot be the sum of these positive addends.",
          "expectedRational": {
            "numerator": 3,
            "denominator": 4
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 2
            },
            {
              "numerator": 1,
              "denominator": 4
            }
          ]
        }
      ],
      "teacherPrompts": [
        "Are both wholes the same size?",
        "What kind of part are we counting?",
        "Can we rename the fractions without changing their values?"
      ],
      "scaffolds": "Provide equal-length blank fraction bars and strips divided into fourths and tenths. Record hints or worked examples as support for this activity."
    },
    {
      "id": "entry-check-v1",
      "suggestedMinutes": 3,
      "conditions": "No hints, worked examples, or peer help; record any actual assistance.",
      "prompts": [
        {
          "id": "entry-01",
          "prompt": "Calculate 1/4 + 1/2. Show one equivalent-fraction step.",
          "canonicalFraction": "3/4",
          "answerKey": "1/2 = 2/4; 1/4 + 2/4 = 3/4.",
          "expectedRational": {
            "numerator": 3,
            "denominator": 4
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 4
            },
            {
              "numerator": 1,
              "denominator": 2
            }
          ]
        },
        {
          "id": "entry-02",
          "prompt": "Calculate 1/6 + 1/2. Show one equivalent-fraction step.",
          "canonicalFraction": "2/3",
          "answerKey": "1/2 = 3/6; 1/6 + 3/6 = 4/6 = 2/3.",
          "expectedRational": {
            "numerator": 2,
            "denominator": 3
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 6
            },
            {
              "numerator": 1,
              "denominator": 2
            }
          ]
        }
      ],
      "nextAction": "Teacher inspects what was shown and selects application or additional information gathering; no runtime automatic reassignment during teaching is required.",
      "title": "Independent entry check"
    },
    {
      "id": "application-practice-v1",
      "suggestedMinutes": 9,
      "prompts": [
        {
          "id": "apply-01",
          "prompt": "A class uses 1/4 meter of blue ribbon and 1/5 meter of green ribbon. Find the total length. Show working.",
          "canonicalFraction": "9/20",
          "answerKey": "1/4 = 5/20; 1/5 = 4/20; total 9/20 meter.",
          "expectedRational": {
            "numerator": 9,
            "denominator": 20
          },
          "answerUnit": "meter",
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 4
            },
            {
              "numerator": 1,
              "denominator": 5
            }
          ]
        },
        {
          "id": "apply-02",
          "prompt": "One plant grows 1/5 meter in a month and another 1/2 meter in the same month. How much growth is that altogether? Show working.",
          "canonicalFraction": "7/10",
          "answerKey": "1/5 = 2/10; 1/2 = 5/10; total 7/10 meter.",
          "expectedRational": {
            "numerator": 7,
            "denominator": 10
          },
          "answerUnit": "meter",
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 5
            },
            {
              "numerator": 1,
              "denominator": 2
            }
          ]
        }
      ],
      "note": "Students who do not need an entry check may spend the whole 12-minute block on application and explaining their methods.",
      "title": "Independent application"
    },
    {
      "id": "extension-explain-v1",
      "title": "Two methods, one value",
      "suggestedMinutes": 12,
      "prompts": [
        {
          "id": "extend-01",
          "prompt": "Solve 1/4 + 2/5 using twentieths and again using fortieths. Explain why the answers have the same value.",
          "canonicalFraction": "13/20",
          "answerKey": "5/20 + 8/20 = 13/20; 10/40 + 16/40 = 26/40 = 13/20.",
          "expectedRational": {
            "numerator": 13,
            "denominator": 20
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 4
            },
            {
              "numerator": 2,
              "denominator": 5
            }
          ]
        },
        {
          "id": "extend-02",
          "prompt": "Write two different pairs of positive fractions with unlike denominators that add to 3/4. Prove each pair works.",
          "canonicalFraction": "3/4",
          "answerKey": "Examples: 1/2 + 1/4 = 3/4; 1/3 + 5/12 = 4/12 + 5/12 = 9/12 = 3/4. Accept other valid pairs.",
          "expectedRational": {
            "numerator": 3,
            "denominator": 4
          },
          "answerUnit": null,
          "validationKind": "construct-addition",
          "operands": [],
          "constructionConstraints": {
            "pairCount": 2,
            "addendsPerPair": 2,
            "positiveProperFractions": true,
            "unlikeDenominators": true,
            "distinctPairs": true,
            "target": {
              "numerator": 3,
              "denominator": 4
            }
          },
          "examplePairs": [
            [
              {
                "numerator": 1,
                "denominator": 2
              },
              {
                "numerator": 1,
                "denominator": 4
              }
            ],
            [
              {
                "numerator": 1,
                "denominator": 3
              },
              {
                "numerator": 5,
                "denominator": 12
              }
            ]
          ]
        },
        {
          "id": "extend-03",
          "prompt": "Explain why adding the denominators does not count equal-sized parts. Use one of your calculations as evidence.",
          "canonicalFraction": null,
          "answerKey": "An explanation should connect denominator to part size, rename unlike units into the same unit, and retain that denominator when adding numerators.",
          "expectedRational": null,
          "answerUnit": null,
          "validationKind": "explanation",
          "operands": [],
          "requiresTeacherReview": true
        }
      ]
    },
    {
      "id": "exit-equal-units-v1",
      "title": "What kind of part are we counting?",
      "suggestedMinutes": 5,
      "prompts": [
        {
          "id": "exit-01",
          "prompt": "Calculate 1/4 + 1/6. Show how you use equal-sized parts.",
          "canonicalFraction": "5/12",
          "answerKey": "1/4 = 3/12; 1/6 = 2/12; total 5/12.",
          "expectedRational": {
            "numerator": 5,
            "denominator": 12
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 4
            },
            {
              "numerator": 1,
              "denominator": 6
            }
          ]
        },
        {
          "id": "exit-02",
          "prompt": "Finish the sentence: Before adding, I rewrite the fractions because\u2026",
          "canonicalFraction": null,
          "answerKey": "Accept an explanation that the fractions need the same-sized parts/common unit before their counts can be added.",
          "expectedRational": null,
          "answerUnit": null,
          "validationKind": "explanation",
          "operands": [],
          "requiresTeacherReview": true
        }
      ],
      "note": "This lesson exit ticket is distinct from the next day's two-question follow-up upload. It may be recorded as an observation, but no extra scan set is required for the demo."
    },
    {
      "id": "followup-template-v1",
      "title": "A fresh fraction check",
      "suggestedMinutes": 8,
      "conditions": "Complete independently; record any help.",
      "prompts": [
        {
          "id": "fq01",
          "prompt": "Calculate 1/3 + 1/4. Show equivalent fractions or an equal-whole model that explains your answer.",
          "canonicalFraction": "7/12",
          "answerKey": "1/3 = 4/12; 1/4 = 3/12; 4/12 + 3/12 = 7/12",
          "expectedRational": {
            "numerator": 7,
            "denominator": 12
          },
          "answerUnit": null,
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 3
            },
            {
              "numerator": 1,
              "denominator": 4
            }
          ]
        },
        {
          "id": "fq02",
          "prompt": "Jules uses 1/6 meter of ribbon for one tag and 1/3 meter for another. How much ribbon is used altogether? Show your working and include the unit.",
          "canonicalFraction": "1/2",
          "answerKey": "1/3 = 2/6; 1/6 + 2/6 = 3/6; 3/6 = 1/2; Jules uses 1/2 meter altogether.",
          "expectedRational": {
            "numerator": 1,
            "denominator": 2
          },
          "answerUnit": "meter",
          "validationKind": "fraction-addition",
          "operands": [
            {
              "numerator": 1,
              "denominator": 6
            },
            {
              "numerator": 1,
              "denominator": 3
            }
          ]
        }
      ]
    }
  ]
};
export const curriculum = {...authored, lessons: authored.lessons as LessonSnapshot[], materials: authored.materials as Material[]};
export type Question = typeof curriculum.questions[number];
export function getQuestion(id: string): Question { const question = curriculum.questions.find(q => q.id === id); if (!question) throw new Error(`Unknown question: ${id}`); return question; }
export function getTemplate(id: string) { const template = curriculum.templates.find(t => t.id === id); if (!template) throw new Error(`Unknown template: ${id}`); return template; }
