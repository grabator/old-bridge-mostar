-- the business chose a 50% deposit (refund up to 48 h before the tour): replace the old suggested 30%
UPDATE meta SET value = json_set(value, '$.policy.depositPercent', 50)
WHERE key = 'site' AND json_valid(value) AND json_extract(value, '$.policy.depositPercent') = 30;
