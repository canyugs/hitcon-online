# -*- coding: utf-8 -*-
import csv
import json
all_problems = []
with open('problems.csv', newline='') as csvfile:

  rows = csv.reader(csvfile)
  for row in rows:
    problem = {}
    problem['dialogs'] = row[3]
    problem['options'] =row[4].splitlines()
    problem['ans'] =row[5]
    all_problems.append(problem)

f = open("problems.json", "w")
f.write(json.dumps(all_problems, ensure_ascii=False, indent=4))
f.close()



