import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User, { Role, CandidateStatus } from '../models/User';
import Exam, { ExamStatus, ResultVisibility } from '../models/Exam';
import Question, { QuestionType, Difficulty } from '../models/Question';
import Assignment, { AssignmentStatus } from '../models/Assignment';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proctorguard';

const seedDemo = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    console.log('Cleaning up existing demo data...');
    await User.deleteMany({ email: { $in: ['admin@proctorguard.local', 'candidate1@proctorguard.local', 'candidate2@proctorguard.local'] } });
    const demoExams = await Exam.find({ title: 'Aptitude & Logical Reasoning Assessment' });
    for (const ex of demoExams) {
      await Question.deleteMany({ examId: ex._id });
      await Assignment.deleteMany({ examId: ex._id });
    }
    await Exam.deleteMany({ title: 'Aptitude & Logical Reasoning Assessment' });

    console.log('Creating Admin...');
    const adminPass = await bcrypt.hash('admin123', 10);
    const admin = new User({
      name: 'Admin User',
      email: 'admin@proctorguard.local',
      passwordHash: adminPass,
      role: Role.ADMIN,
      isEmailVerified: true
    });
    await admin.save();

    console.log('Creating Candidates...');
    const candPass = await bcrypt.hash('candidate123', 10);
    const cand1 = new User({
      name: 'Candidate One',
      email: 'candidate1@proctorguard.local',
      passwordHash: candPass,
      role: Role.CANDIDATE,
      status: CandidateStatus.APPROVED,
      isEmailVerified: true
    });
    await cand1.save();

    const cand2 = new User({
      name: 'Candidate Two',
      email: 'candidate2@proctorguard.local',
      passwordHash: candPass,
      role: Role.CANDIDATE,
      status: CandidateStatus.APPROVED,
      isEmailVerified: true
    });
    await cand2.save();

    console.log('Creating Exam...');
    const exam = new Exam({
      title: 'Aptitude & Logical Reasoning Assessment',
      description: 'A comprehensive assessment testing quantitative aptitude, logical reasoning, and verbal ability. Ensure you are in a quiet environment before starting.',
      instructions: 'You have 60 minutes. Do not switch tabs. Do not use a calculator.',
      duration: 60,
      startAt: new Date(),
      endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
      attemptLimit: 1,
      scoringRules: {
        positiveMarks: 1,
        negativeMarks: 0.25
      },
      resultVisibility: ResultVisibility.IMMEDIATE,
      proctoringConfig: {
        cameraRequired: true,
        screenShareRequired: true,
        fullscreenRequired: true,
        tabSwitchPolicy: 'STRICT',
        networkGracePeriod: 300,
        recordingRetentionPeriod: 30
      },
      status: ExamStatus.PUBLISHED,
      version: 1
    });
    await exam.save();

    console.log('Creating Questions...');
    const questions = [
      // 8 MCQs
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Quantitative Aptitude',
        difficulty: Difficulty.EASY,
        text: 'If a person walks at 14 km/hr instead of 10 km/hr, he would have walked 20 km more. The actual distance travelled by him is:',
        options: [{ id: 'A', text: '50 km' }, { id: 'B', text: '56 km' }, { id: 'C', text: '70 km' }, { id: 'D', text: '80 km' }],
        correctAnswer: 'A',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Quantitative Aptitude',
        difficulty: Difficulty.MEDIUM,
        text: 'The sum of ages of 5 children born at the intervals of 3 years each is 50 years. What is the age of the youngest child?',
        options: [{ id: 'A', text: '4 years' }, { id: 'B', text: '8 years' }, { id: 'C', text: '10 years' }, { id: 'D', text: 'None of these' }],
        correctAnswer: 'A',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Logical Reasoning',
        difficulty: Difficulty.EASY,
        text: 'Look at this series: 2, 1, (1/2), (1/4), ... What number should come next?',
        options: [{ id: 'A', text: '(1/3)' }, { id: 'B', text: '(1/8)' }, { id: 'C', text: '(2/8)' }, { id: 'D', text: '(1/16)' }],
        correctAnswer: 'B',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Verbal Ability',
        difficulty: Difficulty.MEDIUM,
        text: 'Find the correctly spelt word.',
        options: [{ id: 'A', text: 'Adulation' }, { id: 'B', text: 'Adalation' }, { id: 'C', text: 'Aduletian' }, { id: 'D', text: 'Addulation' }],
        correctAnswer: 'A',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Logical Reasoning',
        difficulty: Difficulty.HARD,
        text: 'Odometer is to mileage as compass is to:',
        options: [{ id: 'A', text: 'speed' }, { id: 'B', text: 'hiking' }, { id: 'C', text: 'needle' }, { id: 'D', text: 'direction' }],
        correctAnswer: 'D',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Quantitative Aptitude',
        difficulty: Difficulty.MEDIUM,
        text: 'A sum of money at simple interest amounts to Rs. 815 in 3 years and to Rs. 854 in 4 years. The sum is:',
        options: [{ id: 'A', text: 'Rs. 650' }, { id: 'B', text: 'Rs. 690' }, { id: 'C', text: 'Rs. 698' }, { id: 'D', text: 'Rs. 700' }],
        correctAnswer: 'C',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Verbal Ability',
        difficulty: Difficulty.EASY,
        text: 'Synonym of BRIEF is:',
        options: [{ id: 'A', text: 'Limited' }, { id: 'B', text: 'Small' }, { id: 'C', text: 'Little' }, { id: 'D', text: 'Short' }],
        correctAnswer: 'D',
        marks: 1, negativeMarks: 0.25
      },
      {
        examId: exam._id,
        type: QuestionType.SINGLE_CHOICE,
        category: 'Logical Reasoning',
        difficulty: Difficulty.MEDIUM,
        text: 'Which word does NOT belong with the others?',
        options: [{ id: 'A', text: 'Cornea' }, { id: 'B', text: 'Retina' }, { id: 'C', text: 'Pupil' }, { id: 'D', text: 'Vision' }],
        correctAnswer: 'D',
        marks: 1, negativeMarks: 0.25
      },
      // 1 True/False
      {
        examId: exam._id,
        type: QuestionType.TRUE_FALSE,
        category: 'General Knowledge',
        difficulty: Difficulty.EASY,
        text: 'The JavaScript programming language was developed by Microsoft.',
        options: [{ id: 'True', text: 'True' }, { id: 'False', text: 'False' }],
        correctAnswer: 'False',
        marks: 1, negativeMarks: 0
      },
      // 1 Multiple Select
      {
        examId: exam._id,
        type: QuestionType.MULTIPLE_CHOICE,
        category: 'Computer Science',
        difficulty: Difficulty.MEDIUM,
        text: 'Which of the following are valid HTTP methods?',
        options: [{ id: 'A', text: 'GET' }, { id: 'B', text: 'FETCH' }, { id: 'C', text: 'POST' }, { id: 'D', text: 'PULL' }],
        correctAnswer: ['A', 'C'], // Array of correct IDs
        marks: 2, negativeMarks: 0
      }
    ];

    for (const q of questions) {
      await new Question(q).save();
    }

    console.log('Assigning Candidates to Exam...');
    const assign1 = new Assignment({
      examId: exam._id,
      candidateId: cand1._id,
      allowedAttempts: 1,
      scheduledAt: new Date(),
      status: AssignmentStatus.PENDING
    });
    await assign1.save();

    const assign2 = new Assignment({
      examId: exam._id,
      candidateId: cand2._id,
      allowedAttempts: 1,
      scheduledAt: new Date(),
      status: AssignmentStatus.PENDING
    });
    await assign2.save();

    console.log('Seed completed successfully!');
    console.log('Admin Email: admin@proctorguard.local / admin123');
    console.log('Candidate 1 Email: candidate1@proctorguard.local / candidate123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seedDemo();
