import { QuizQuestion } from '../types/quiz.js';
import { Batch } from '../types/deck.js';
import { composeBatchMulti } from '../engine/compose-batch.js';
import { MockConsonant } from '../../data/mock/mock-consonants.js';
import { MockWord } from '../../data/mock/mock-words.js';

function readKey(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (key: string) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(key);
    });
  });
}

function readLine(): Promise<string> {
  return new Promise(resolve => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (line: string) => {
      process.stdin.pause();
      resolve(line.trim().toLowerCase());
    });
  });
}

export async function runInteractive(questions: QuizQuestion[]): Promise<{ correct: number; total: number }> {
  let score = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\nQuestion ${i + 1} of ${questions.length}`);
    console.log(q.prompt);
    for (const choice of q.choices) {
      console.log(`  ${choice.label}) ${choice.value}`);
    }
    process.stdout.write('Your answer (a/b/c/d): ');

    let answer: string;
    while (true) {
      const key = (await readKey()).toLowerCase();
      if (key === '\u0003') process.exit(); // Ctrl+C
      if (['a', 'b', 'c', 'd'].includes(key)) { answer = key; break; }
    }

    console.log(answer!);

    const selected = q.choices.find(c => c.label === answer)!;
    const correct = q.choices.find(c => c.isCorrect)!;

    if (selected.isCorrect) {
      console.log('Correct!');
      score++;
    } else {
      console.log(`Wrong — correct answer was: ${correct.value}`);
    }
  }

  console.log(`\nScore: ${score} / ${questions.length}`);
  return { correct: score, total: questions.length };
}

export async function runBatchLoop(
  batches: Batch[],
  fullWordPool: MockWord[],
  fullFoundationalPool: MockConsonant[],
): Promise<void> {
  let totalCorrect = 0;
  let totalQuestions = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const isLast = i === batches.length - 1;

    console.log(`\n=== Batch ${i + 1} of ${batches.length} ===`);

    const consonantLimit = Math.ceil(batch.questionLimit / 2);
    const wordLimit = batch.questionLimit - consonantLimit;

    const consonantQuestions = composeBatchMulti(batch.focusFoundational, fullFoundationalPool, { questionLimit: consonantLimit });
    const wordQuestions = composeBatchMulti(batch.focusWords, fullWordPool, { questionLimit: wordLimit });
    const questions = [...consonantQuestions, ...wordQuestions].sort(() => Math.random() - 0.5);

    const { correct, total } = await runInteractive(questions);
    totalCorrect += correct;
    totalQuestions += total;

    if (!isLast) {
      process.stdout.write('\nNext batch? (y/n): ');
      const answer = await readLine();
      if (answer !== 'y') break;
    }
  }

  console.log('\n=== Run Complete ===');
  console.log(`Batches: ${batches.length}`);
  console.log(`Score:   ${totalCorrect} / ${totalQuestions}`);
}
