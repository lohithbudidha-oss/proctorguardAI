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
Q26. Premises:All Alpha are Beta.No Beta are Gamma.Some Delta are Gamma.Which conclusion logically follows with certainty?(A) No Delta are Alpha(B) Some Delta are not Alpha(C) All Beta are Delta(D) Some Alpha are Gamma
Q27. On a standard 6-sided die, opposite faces sum to 7. If three visible faces at a single corner show 1, 2, and 3, what is the orientation condition for this to be a valid standard die?(A) 1, 2, 3 must go counter-clockwise around their shared vertex(B) 1, 2, 3 must go clockwise around their shared vertex(C) It is impossible regardless of orientation(D) It is always valid in any orientation
Q28. In a $5 \\times 5$ binary grid, you can invert all bits in any chosen row or column. Can a grid with a single 1 and twenty-four 0s be converted into an all-zero grid?(A) Yes, in 5 moves(B) Yes, in 10 moves(C) No, because $2 \\times 2$ parity invariants are preserved(D) Yes, but only if applied along main diagonal
Q29. Five speakers (P, Q, R, S, T) present in five time slots. P must present before Q, R must present immediately after S, and T cannot present in slot 1 or 5. How many valid schedules exist?(A) 6(B) 12(C) 18(D) 24
Q30. Find $X$ in the numeric matrix based on pattern symmetry:$$\\begin{pmatrix} 4 & 7 & 18 \\\\ 6 & 2 & 10 \\\\ 5 & 9 & X \\end{pmatrix}$$(A) 19(B) 21(C) 23(D) 25
Q31. Find the area of the region bounded by $\\vert{}x\\vert{} + \\vert{}y\\vert{} + \\vert{}x + y\\vert{} \\le 2$.(A) 3 square units(B) 4 square units(C) 6 square units(D) 8 square units
Q32. An equilateral triangle of side length $a$ is rotated around one of its sides by $360^\\circ$. Find the total volume of the resulting 3D solid.(A) \\frac{\\pi a^3}{2}(B) \\frac{\\pi a^3}{3}(C) \\frac{\\pi a^3}{4}(D) \\frac{\\sqrt{3}\\pi a^3}{6}
Q33. A sphere is inscribed inside a right circular cone of base radius $r$ and height $h$. What is the radius $R$ of the sphere?(A) $R = \\frac{rh}{\\sqrt{r^2 + h^2} + r}$(B) $R = \\frac{rh}{\\sqrt{r^2 + h^2}}$(C) $R = \\frac{r^2 h}{r^2 + h^2}$(D) $R = \\frac{rh}{2r + h}$
Q34. Three circles of equal radius $R$ are mutually tangent to each other externally. What is the area of the enclosed region between them?(A) $R^2 \\left( \\sqrt{3} - \\frac{\\pi}{2} \\right)$(B) $R^2 \\left( 2\\sqrt{3} - \\pi \\right)$(C) $R^2 \\left( \\sqrt{3} - \\frac{\\pi}{3} \\right)$(D) \\frac{\\pi R^2}{6}
Q35. In $\\triangle ABC$, $AB = 13$, $BC = 14$, and $AC = 15$. Find the length of the altitude drawn from vertex $A$ to side $BC$.(A) 10(B) 11(C) 12(D) 13
Q36. At what exact time after 12:00 do the minute hand and hour hand of a clock overlap next?(A) 1 hour, 5 minutes, 20 seconds(B) 1 hour, 5 minutes, 27.27 seconds ($1 \\text{ hr } 5 \\frac{5}{11} \\text{ min}$)(C) 1 hour, 5 minutes, 30 seconds(D) 1 hour, 6 minutes, 0 seconds
Q37. A fair coin is flipped 10 times. What is the probability of getting at least 3 consecutive heads?(A) \\frac{256}{1024}(B) \\frac{521}{1024}(C) \\frac{612}{1024}(D) \\frac{720}{1024}
Q38. Find the number of non-negative integral solutions to $x_1 + x_2 + x_3 + x_4 = 20$.(A) 1140(B) 1540(C) 1771(D) 2024
Q39. Evaluate the infinite nested radical: $x = \\sqrt{6 + \\sqrt{6 + \\sqrt{6 + \\dots}}}$(A) 2(B) 3(C) 6(D) \\infty
Q40. Pipe A fills a tank in 10 hours, Pipe B in 15 hours. Pipe C empties it in 12 hours. If all three open together, how many hours to fill the empty tank?(A) 6 hours(B) 8.57 hours (\\frac{60}{7} hours)(C) 10 hours(D) 12 hours
Q41. The average score of 30 students is 75. Excluding the highest and lowest scores, the remaining average is 74. If Highest $-$ Lowest $= 40$, find the highest score.(A) 89(B) 98(C) 109(D) 115
Q42. $A$ can do work in 12 days, $B$ in 15 days, $C$ in 20 days. $A$ works alone for 2 days, then $B$ joins $A$ for 2 days. Then $A$ leaves and $C$ joins $B$. How many total days were taken to finish the work?(A) 6 days(B) 7 days(C) 8 days(D) 9 days
Q43. How many integers between 1 and 1000 inclusive are divisible by neither 2, 3, nor 5?(A) 233(B) 266(C) 300(D) 333
Q44. A boat travels 24 km upstream and 28 km downstream in 6 hours. It also travels 30 km upstream and 21 km downstream in 6.5 hours. Find the speed of the boat in still water.(A) 8 km/h(B) 10 km/h(C) 12 km/h(D) 14 km/h
Q45. Two towers $h_1$ and $h_2$ stand on flat ground. From the base of each tower, the angle of elevation of the top of the other tower is $30^\\circ$ and $60^\\circ$ respectively. Find the ratio $h_1 : h_2$.(A) $1 : 2$(B) $1 : 3$(C) $1 : \\sqrt{3}$(D) $2 : 3$
`;

const answers: Record<string, string> = {
  '1': 'B', '2': 'C', '3': 'C', '4': 'B', '5': 'B', '6': 'B', '7': 'B', '8': 'B', '9': 'C', '10': 'B',
  '11': 'B', '12': 'B', '13': 'B', '14': 'A', '15': 'A', '16': 'B', '17': 'B', '18': 'B', '19': 'B', '20': 'C',
  '21': 'A', '22': 'C', '23': 'A', '24': 'C', '25': 'B', '26': 'B', '27': 'A', '28': 'C', '29': 'B', '30': 'C',
  '31': 'C', '32': 'C', '33': 'A', '34': 'A', '35': 'C', '36': 'B', '37': 'B', '38': 'C', '39': 'B', '40': 'B',
  '41': 'C', '42': 'B', '43': 'B', '44': 'B', '45': 'B'
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
