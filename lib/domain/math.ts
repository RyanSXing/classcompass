import type { MathCheck, Rational } from '../contracts';
import type { Question } from '../curriculum';

export function gcd(a: number, b: number): number { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; }
export function reduce(value: Rational): Rational { const d = gcd(value.numerator, value.denominator); return { numerator: value.numerator / d, denominator: value.denominator / d }; }
export function equalFractions(a: Rational, b: Rational): boolean { return a.numerator * b.denominator === b.numerator * a.denominator; }
export function addFractions(a: Rational, b: Rational): Rational { return reduce({ numerator: a.numerator * b.denominator + b.numerator * a.denominator, denominator: a.denominator * b.denominator }); }
export function parseFraction(text: string | null): Rational | null {
  if (!text) return null;
  // Worksheet labels can be part of a faithful transcription. Accept only this
  // literal label; the anchored fraction grammar still rejects extra expressions.
  const match = text.trim().match(/^(?:answer(?:\s*:\s*|\s+))?(-?\d+)\s*\/\s*(-?\d+)(?:\s*(?:meters?|metres?|m))?\s*[.!]?$/i);
  if (!match) return null;
  let numerator = Number(match[1]), denominator = Number(match[2]);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || Math.abs(numerator) > 10000 || Math.abs(denominator) > 10000 || denominator === 0) return null;
  if (denominator < 0) { numerator *= -1; denominator *= -1; }
  return { numerator, denominator };
}
function simpleFraction(text: string): Rational | null { const match = text.trim().match(/^(-?\d+\s*\/\s*\d+)(?:\s+(?:meters?|metres?|m))?$/i); return match ? parseFraction(match[1]) : null; }
function correctRenameCount(working: string, addends?: Rational[]): number {
  let count = 0;
  for (const match of working.matchAll(/(?=(\b\d+\s*\/\s*\d+)\s*=\s*(\d+\s*\/\s*\d+)(?![\d]|\s*\+))/g)) {
    const left = parseFraction(match[1]), right = parseFraction(match[2]);
    if (left && right && equalFractions(left, right) && left.denominator !== right.denominator && (!addends || addends.some(a => a.numerator === left.numerator && a.denominator === left.denominator))) count++;
  }
  return count;
}
export function checkMath(question: Question, workingText: string, answerText: string | null, legibility: 'clear' | 'uncertain' | 'blank'): MathCheck {
  const expected = question.expectedAnswer.rational;
  const parsed = parseFraction(answerText);
  const contradictions: string[] = [];
  for (const clause of workingText.split(/[;\n.]/)) {
    const parts = clause.split('=');
    for (let i = 0; i < parts.length - 1; i++) {
      const left = simpleFraction(parts[i]), right = simpleFraction(parts[i + 1]);
      if (left && right && !equalFractions(left, right)) contradictions.push(`${parts[i].trim()} is not equivalent to ${parts[i + 1].trim()}.`);
    }
  }
  const finalWritten = workingText.trim().match(/(-?\d+\s*\/\s*\d+)(?:\s*(?:meters?|metres?|m))?\s*[.!]?$/i);
  const finalFraction = finalWritten ? parseFraction(finalWritten[1]) : null;
  if (parsed && finalFraction && !equalFractions(parsed, finalFraction)) contradictions.push('The final answer differs from the last written result.');
  const [a, b] = question.operands;
  const naive = { numerator: a.numerator + b.numerator, denominator: a.denominator + b.denominator };
  // A mistaken final answer is not enough to diagnose an operation. Require the
  // original addends to be added directly, or explicit numerator/denominator sums.
  const fractionPattern = (v: Rational) => `${v.numerator}\\s*\\/\\s*${v.denominator}`;
  const directPattern = new RegExp(`(?:^|[;\\n])\\s*${fractionPattern(a)}\\s*\\+\\s*${fractionPattern(b)}\\s*=\\s*`);
  const directAddition = directPattern.test(workingText);
  const separateBottoms = new RegExp(`(?:^|[;\\n])\\s*${a.denominator}\\s*\\+\\s*${b.denominator}\\s*=\\s*${a.denominator+b.denominator}(?:\\s*[;\\n]|$)`).test(workingText);
  const separateTops = new RegExp(`(?:^|[;\\n])\\s*${a.numerator}\\s*\\+\\s*${b.numerator}\\s*=\\s*${a.numerator+b.numerator}(?:\\s*[;\\n]|$)`).test(workingText);
  const hasCorrectRenaming = correctRenameCount(workingText, question.operands) > 0;
  const denominatorAddition = Boolean(parsed && equalFractions(parsed, naive) && !equalFractions(naive, expected) && ((directAddition && !hasCorrectRenaming) || (separateBottoms && separateTops)));
  const validRenamedAddition = [...workingText.matchAll(/(?=(\d+\s*\/\s*\d+)\s*\+\s*(\d+\s*\/\s*\d+)\s*=\s*(\d+\s*\/\s*\d+))/g)].some(match => {
    const left = parseFraction(match[1]), right = parseFraction(match[2]), result = parseFraction(match[3]);
    return !!left && !!right && !!result && left.denominator === right.denominator && ((equalFractions(left,a) && equalFractions(right,b)) || (equalFractions(left,b) && equalFractions(right,a))) && equalFractions(addFractions(left,right),result);
  });
  // A true equivalence about an unrelated fraction does not demonstrate the
  // method for this task. Chained common-unit additions are also valid evidence.
  const equivalentReasoning = (hasCorrectRenaming || validRenamedAddition) && contradictions.length === 0;
  const blank = legibility === 'blank' && !workingText.trim() && !answerText;
  const status = blank ? 'blank' : !parsed || legibility === 'uncertain' ? 'unresolved' : equalFractions(parsed, expected) ? 'correct' : 'incorrect';
  const unitStatus = !question.answerUnit ? 'not_required' : !answerText ? 'unresolved' : /\b(?:meters?|metres?|m)\b/i.test(answerText) ? 'correct' : parsed ? 'missing' : 'unresolved';
  return { status, parsed, expected, unitStatus, contradictions, denominatorAddition, equivalentReasoning, checkerVersion: 3 };
}
