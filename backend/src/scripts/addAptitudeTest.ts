import mongoose from 'mongoose';
import Exam from '../models/Exam';
import Question, { QuestionType, Difficulty } from '../models/Question';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aptitude_portal';

const rawData = `
Q1. A regular 20-gon (icosa-gon) is drawn in a plane. How many triangles can be formed using its vertices such that no side of the triangle is a side of the 20-gon?(A) 680(B) 800(C) 840(D) 1140
Q2. Find the remainder when $3^{2026}$ is divided by $100$.(A) 01(B) 03(C) 09(D) 27
Q3. Two runners, $A$ and $B$, start simultaneously from point $P$ on a circular track of radius $R$. $A$ runs clockwise at speed $v$, while $B$ runs counter-clockwise at speed $2v$. Every time they meet, $B$'s speed is halved and $A$'s speed is doubled. At what angular displacement from $P$ along the clockwise direction do they meet for the 3rd time?(A) $60^\\circ$(B) $90^\\circ$(C) $120^\\circ$(D) $180^\\circ$
Q4. A bag contains 5 red balls, 4 green balls, and 3 blue balls. Balls are drawn one by one at random without replacement. What is the probability that all 5 red balls are drawn before all 4 green balls are drawn?(A) \\frac{5}{9}(B) \\frac{4}{9}(C) \\frac{5}{12}(D) \\frac{1}{3}
Q5. Solve for the number of integer solutions $(x, y, z)$ satisfying:$$x + y + z = 18 \\quad \\text{where } 1 \\le x \\le 8, \\quad 2 \\le y \\le 9, \\quad 3 \\le z \\le 10$$(A) 28(B) 36(C) 42(D) 55
Q6. The sequence $a_n$ is defined by $a_1 = 2$ and $a_{n+1} = a_n^2 - a_n + 1$ for $n \\ge 1$. If $S_N = \\sum_{k=1}^N \\frac{1}{a_k}$, evaluate $\\lfloor S_{2026} \\rfloor$.(A) 0(B) 1(C) 2(D) 2026
Q7. Find the coefficient of $x^{10}$ in the polynomial expansion of $P(x) = (1 + x + x^2 + x^3 + x^4 + x^5)^{10}$.(A) 3003(B) 8008(C) 8400(D) 9225
Q8. A fair 6-sided die is rolled repeatedly until the sequence $(1, 2, 1)$ appears in three consecutive rolls. What is the expected number of total rolls required?(A) 216(B) 222(C) 234(D) 240
Q9. Let $f(x) = x^4 - 4x^3 + 6x^2 - 4x + 5$. Find the minimum value of $f(x)$ for all real numbers $x$.(A) 0(B) 1(C) 4(D) 5
Q10. Four ants sit on four corners of a unit square (side length = 1). At time $t = 0$, each ant begins walking directly toward the ant to its right at a constant speed $v$. How much total distance does each ant travel before they all collide at the center?(A) 0.5 units(B) 1.0 unit(C) $\\sqrt{2}$ units(D) $\\frac{\\pi}{2}$ units
Q11. Find the number of ordered pairs of integers $(x, y)$ that satisfy the equation $x^2 y - 3x^2 - 4y + 11 = 0$.(A) 2(B) 4(C) 6(D) 8
Q12. A worker is at point $(0,0)$ on a 2D integer grid. At each step, they can move $+1$ unit Right or $+1$ unit Up. How many paths lead to $(6,6)$ without crossing strictly above the main diagonal line $y = x$?(A) 42(B) 132(C) 462(D) 924
Q13. Compute the unit digit of the expression: $1! + 2!! + 3! + 4!! + 5! + 6!! + \\dots + 100!!$(A) 1(B) 3(C) 5(D) 7
Q14. How many prime numbers $p$ exist such that $2^p + p^2$ is also a prime number?(A) Exactly 1(B) Exactly 2(C) Exactly 3(D) Infinitely many
Q15. The polynomial $x^3 - p x^2 + q x - r = 0$ has roots $\\alpha, \\beta, \\gamma$. Express $\\alpha^3 + \\beta^3 + \\gamma^3$ strictly in terms of $p, q, r$.(A) $p^3 - 3pq + 3r$(B) $p^3 + 3pq - r$(C) $p^3 - 3pq - 3r$(D) $3pq - p^3 + r$
Q16. Knights always tell the truth, Knaves always lie, and Normals can either lie or tell the truth. Among A, B, and C, there is exactly one Knight, one Knave, and one Normal:A says: "I am a Normal."B says: "A is telling the truth."C says: "I am not Normal."Which of the following is correct?(A) A is Knight, B is Knave, C is Normal(B) A is Normal, B is Knave, C is Knight(C) A is Knave, B is Knight, C is Normal(D) A is Normal, B is Knight, C is Knave
Q17. You have 12 visually identical coins, one of which is counterfeit (weighs either lighter or heavier than genuine ones). What is the absolute minimum number of weighings required on a balance scale to guarantee finding the counterfeit coin AND whether it is heavier or lighter?(A) 2(B) 3(C) 4(D) 5
Q18. In the 100 Prisoners and Lightbulb Problem, prisoners enter a switch room one by one. To guarantee an accurate count when one prisoner announces all 100 have visited, how many total times should a regular non-leader prisoner flip the light switch ON?(A) Every time they enter and see it OFF(B) Exactly once in total(C) Exactly twice in total(D) Only when the leader instructs them
Q19. Three wizards sit facing forward in a line (Wizard 3 sees 2 and 1; Wizard 2 sees 1; Wizard 1 sees no one). They know there are 3 Black and 2 White hats. Hats are placed on their heads.Wizard 3 says: "I do not know my hat color."Wizard 2 then says: "I do not know my hat color."Wizard 1 says: "I know my hat color!"What color is Wizard 1's hat?(A) White(B) Black(C) Red(D) Cannot be determined
Q20. A $4 \\times 4 \\times 4$ cube is painted red on all outer surfaces and cut into 64 unit cubes ($1 \\times 1 \\times 1$). How many unit cubes have exactly 2 faces painted?(A) 8(B) 16(C) 24(D) 32
Q21. You have 1000 bottles of wine, exactly one of which is poisoned. A test strip turns red if exposed to poison and takes 24 hours to show a result. What is the minimum number of test strips required to identify the poisoned bottle in 24 hours?(A) 10(B) 100(C) 500(D) 999
Q22. Eight executives (A, B, C, D, E, F, G, H) sit around a circular table:A sits opposite F.B sits two places to the left of D.C is not adjacent to A or F.E sits directly adjacent to both C and G.Who sits directly opposite E?(A) B(B) C(C) D(D) H
Q23. Four statements about an integer $N$:P: "$N$ is divisible by 4."Q: "$N$ is divisible by 9."R: "$N$ is prime."S: "$N$ is odd."If exactly two statements are true and two are false, which statements are true?(A) P and Q(B) Q and R(C) R and S(D) P and S
Q24. Tasks with execution times: A (3d), B (4d, after A), C (2d, after A), D (5d, after B), E (1d, after C & B), F (3d, after D & E). What is the minimum project completion time (Critical Path)?(A) 12 days(B) 13 days(C) 15 days(D) 18 days
Q25. In "The Hardest Logic Puzzle Ever", what is the minimum number of questions required to decipher the true identities of True, False, and Random using a unknown language ('da'/'ja')?(A) 2(B) 3(C) 4(D) 5
Q26. A, B, C, and D are playing cards. A and B are partners and sit opposite each other; C and D are partners and sit opposite each other. N, S, E, W represent North, South, East, West. If A faces North, and C faces West, in which direction does D face?(A) North(B) South(C) East(D) West
Q27. Find the odd one out:(A) 121(B) 169(C) 225(D) 289
Q28. In a row of 40 students, X is 13th from the left end and Y is 17th from the right end. How many students are sitting between X and Y?(A) 8(B) 9(C) 10(D) 11
Q29. In triangle ABC, D and E are points on AB and AC respectively such that DE is parallel to BC. If AD = 3 cm, DB = 5 cm, and the area of triangle ADE is 18 cm^2, what is the area of the quadrilateral DBCE?(A) 110 cm^2(B) 128 cm^2(C) 144 cm^2(D) 162 cm^2
Q30. A right circular cylinder and a right circular cone have equal base radii and equal heights. If the volume of the cylinder is 270 cm^3, what is the volume of the cone?(A) 90 cm^3(B) 135 cm^3(C) 180 cm^3(D) 270 cm^3
Q31. Find the angle between the hour hand and minute hand of a clock at 3:40.(A) 120 degrees(B) 130 degrees(C) 140 degrees(D) 150 degrees
Q32. Two concentric circles have radii of 13 cm and 5 cm. What is the length of the chord of the larger circle that touches the smaller circle as a tangent?(A) 12 cm(B) 18 cm(C) 24 cm(D) 26 cm
Q33. A man walks 10 km North, turns right and walks 6 km, turns right again and walks 18 km. How far and in which direction is he from his starting point?(A) 10 km, South-East(B) 10 km, South-West(C) 12 km, South-East(D) 14 km, South-East
Q34. Find the area of the region bounded by the curve x^2 + y^2 = 16 and the lines x = 0 and y = 0 in the first quadrant.(A) 2 * pi(B) 4 * pi(C) 8 * pi(D) 16 * pi
Q35. Pipe A can fill a cistern in 12 hours, Pipe B in 16 hours. A third Pipe C empties the full cistern in 8 hours. If all three pipes are opened together, how long will it take to fill the empty cistern?(A) 24 hours(B) 36 hours(C) 48 hours(D) 72 hours
Q36. A worker's efficiency increases by 25%. As a result, the time required to complete a task decreases by how many hours if the task originally took 20 hours?(A) 4 hours(B) 5 hours(C) 6 hours(D) 8 hours
Q37. In how many ways can a committee of 4 people be formed from 5 men and 4 women such that the committee contains at least 2 women?(A) 60(B) 81(C) 105(D) 126
Q38. Find the maximum area of a rectangle that can be inscribed in a circle of radius R.(A) R^2(B) sqrt(2) * R^2(C) 2 * R^2(D) 4 * R^2
Q39. The median of a set of 11 distinct numbers arranged in ascending order is 25. If the 3 largest numbers are increased by 5 each, what happens to the median of the new set?(A) Increases by 5(B) Increases by 1.5(C) Decreases by 5(D) Remains unchanged (25)
Q40. Two dice are thrown simultaneously. What is the probability that the sum of the numbers appearing on both dice is a multiple of 4?(A) 1/4(B) 1/3(C) 5/12(D) 1/2
`;

const answers: Record<string, string> = {
  '1': 'B', '2': 'C', '3': 'C', '4': 'B', '5': 'B', '6': 'B', '7': 'B', '8': 'B', '9': 'C', '10': 'B',
  '11': 'B', '12': 'B', '13': 'B', '14': 'A', '15': 'A', '16': 'B', '17': 'B', '18': 'B', '19': 'B', '20': 'C',
  '21': 'A', '22': 'C', '23': 'A', '24': 'C', '25': 'B', '26': 'C', '27': 'C', '28': 'C', '29': 'A', '30': 'A',
  '31': 'B', '32': 'C', '33': 'A', '34': 'B', '35': 'C', '36': 'A', '37': 'B', '38': 'C', '39': 'D', '40': 'A'
};

const addAptitudeTest = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to DB');

    // Create the exam
    const exam = new Exam({
      title: 'aptitude test',
      description: 'Comprehensive aptitude test covering quant, logic, and data.',
      duration: 120, // 2 hours
      status: 'PUBLISHED'
    });

    await exam.save();
    console.log('Exam created:', exam._id);

    const questions = rawData.split('\\n').filter(line => line.trim().startsWith('Q'));

    for (const qLine of questions) {
      // e.g. Q1. A regular 20-gon ... (A) 680(B) 800(C) 840(D) 1140
      const match = qLine.match(/^Q(\\d+)\\.\\s*(.*?)\\s*\\(A\\)\\s*(.*?)\\s*\\(B\\)\\s*(.*?)\\s*\\(C\\)\\s*(.*?)\\s*\\(D\\)\\s*(.*?)$/i);
      
      if (!match) {
        console.error('Failed to parse:', qLine);
        continue;
      }

      const [_, qNum, text, optA, optB, optC, optD] = match;
      const ansLetter = answers[qNum];
      let correctAnswer = '';
      if (ansLetter === 'A') correctAnswer = optA.trim();
      else if (ansLetter === 'B') correctAnswer = optB.trim();
      else if (ansLetter === 'C') correctAnswer = optC.trim();
      else if (ansLetter === 'D') correctAnswer = optD.trim();

      const question = new Question({
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        text: text.trim(),
        options: [
          { id: optA.trim(), text: optA.trim() },
          { id: optB.trim(), text: optB.trim() },
          { id: optC.trim(), text: optC.trim() },
          { id: optD.trim(), text: optD.trim() }
        ],
        correctAnswer: correctAnswer,
        marks: 1,
        category: 'Aptitude'
      });

      await question.save();
      console.log('Saved Q' + qNum);
    }

    console.log('All questions added successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

addAptitudeTest();


