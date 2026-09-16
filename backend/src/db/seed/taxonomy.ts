import { createDatabase } from "..";
import { books, chapters, subjects } from "../schema";

/**
 * HSC syllabus taxonomy, transcribed verbatim from the frontend prototype's
 * `SUBJECTS` constant (docs/acs-doubts-prototype-v2.jsx:544-592) so ids and
 * both English/Bengali names match the UI exactly.
 */
const SUBJECTS: Array<{
	id: string;
	en: string;
	bn: string;
	books: Array<{
		id: string;
		en: string;
		bn: string;
		chapters: Array<{ en: string; bn: string }>;
	}>;
}> = [
	{
		id: "phy",
		en: "Physics",
		bn: "পদার্থবিজ্ঞান",
		books: [
			{
				id: "phy1",
				en: "Physics 1st paper",
				bn: "পদার্থবিজ্ঞান ১ম পত্র",
				chapters: [
					{ en: "Physical world and measurement", bn: "ভৌতজগৎ ও পরিমাপ" },
					{ en: "Vectors", bn: "ভেক্টর" },
					{ en: "Kinematics", bn: "গতিবিদ্যা" },
					{ en: "Newtonian mechanics", bn: "নিউটনিয়ান বলবিদ্যা" },
					{ en: "Work, energy and power", bn: "কাজ, শক্তি ও ক্ষমতা" },
					{ en: "Gravitation", bn: "মহাকর্ষ ও অভিকর্ষ" },
					{ en: "Structural properties of matter", bn: "পদার্থের গাঠনিক ধর্ম" },
					{ en: "Periodic motion", bn: "পর্যাবৃত্ত গতি" },
					{ en: "Waves", bn: "তরঙ্গ" },
					{ en: "Ideal gas and kinetic theory", bn: "আদর্শ গ্যাস ও গ্যাসের গতিতত্ত্ব" },
				],
			},
			{
				id: "phy2",
				en: "Physics 2nd paper",
				bn: "পদার্থবিজ্ঞান ২য় পত্র",
				chapters: [
					{ en: "Thermodynamics", bn: "তাপগতিবিদ্যা" },
					{ en: "Static electricity", bn: "স্থির তড়িৎ" },
					{ en: "Current electricity", bn: "চল তড়িৎ" },
					{ en: "Magnetic effects of current", bn: "তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব" },
					{
						en: "Electromagnetic induction",
						bn: "তাড়িতচৌম্বকীয় আবেশ ও পরিবর্তী প্রবাহ",
					},
					{ en: "Geometrical optics", bn: "জ্যামিতিক আলোকবিজ্ঞান" },
					{ en: "Physical optics", bn: "ভৌত আলোকবিজ্ঞান" },
					{ en: "Introduction to modern physics", bn: "আধুনিক পদার্থবিজ্ঞানের সূচনা" },
					{
						en: "Atomic models and nuclear physics",
						bn: "পরমাণুর মডেল এবং নিউক্লিয়ার পদার্থবিজ্ঞান",
					},
					{ en: "Semiconductors and electronics", bn: "সেমিকন্ডাক্টর ও ইলেকট্রনিক্স" },
					{ en: "Astrophysics", bn: "জ্যোতির্বিজ্ঞান" },
				],
			},
		],
	},
	{
		id: "chem",
		en: "Chemistry",
		bn: "রসায়ন",
		books: [
			{
				id: "chem1",
				en: "Chemistry 1st paper",
				bn: "রসায়ন ১ম পত্র",
				chapters: [
					{ en: "Laboratory safety", bn: "ল্যাবরেটরির নিরাপদ ব্যবহার" },
					{ en: "Qualitative chemistry", bn: "গুণগত রসায়ন" },
					{
						en: "Periodic properties and bonding",
						bn: "মৌলের পর্যায়বৃত্ত ধর্ম ও রাসায়নিক বন্ধন",
					},
					{ en: "Chemical changes", bn: "রাসায়নিক পরিবর্তন" },
					{ en: "Vocational chemistry", bn: "কর্মমুখী রসায়ন" },
				],
			},
			{
				id: "chem2",
				en: "Chemistry 2nd paper",
				bn: "রসায়ন ২য় পত্র",
				chapters: [
					{ en: "Environmental chemistry", bn: "পরিবেশ রসায়ন" },
					{ en: "Organic chemistry", bn: "জৈব রসায়ন" },
					{ en: "Quantitative chemistry", bn: "পরিমাণগত রসায়ন" },
					{ en: "Electrochemistry", bn: "তড়িৎ রসায়ন" },
					{ en: "Economic chemistry", bn: "অর্থনৈতিক রসায়ন" },
				],
			},
		],
	},
	{
		id: "math",
		en: "Higher Math",
		bn: "উচ্চতর গণিত",
		books: [
			{
				id: "math1",
				en: "Higher Math 1st paper",
				bn: "উচ্চতর গণিত ১ম পত্র",
				chapters: [
					{ en: "Matrices and determinants", bn: "ম্যাট্রিক্স ও নির্ণায়ক" },
					{ en: "Vectors", bn: "ভেক্টর" },
					{ en: "Straight lines", bn: "সরলরেখা" },
					{ en: "Circles", bn: "বৃত্ত" },
					{ en: "Permutations and combinations", bn: "বিন্যাস ও সমাবেশ" },
					{ en: "Trigonometric ratios", bn: "ত্রিকোণমিতিক অনুপাত" },
					{
						en: "Ratios of associated angles",
						bn: "সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত",
					},
					{ en: "Functions and graphs", bn: "ফাংশন ও ফাংশনের লেখচিত্র" },
					{ en: "Differentiation", bn: "অন্তরীকরণ" },
					{ en: "Integration", bn: "যোগজীকরণ" },
				],
			},
			{
				id: "math2",
				en: "Higher Math 2nd paper",
				bn: "উচ্চতর গণিত ২য় পত্র",
				chapters: [
					{ en: "Real numbers and inequalities", bn: "বাস্তব সংখ্যা ও অসমতা" },
					{ en: "Linear programming", bn: "যোগাশ্রয়ী প্রোগ্রাম" },
					{ en: "Complex numbers", bn: "জটিল সংখ্যা" },
					{ en: "Polynomial equations", bn: "বহুপদী ও বহুপদী সমীকরণ" },
					{ en: "Binomial expansion", bn: "দ্বিপদী বিস্তৃতি" },
					{ en: "Conics", bn: "কণিক" },
					{
						en: "Inverse trigonometric functions",
						bn: "বিপরীত ত্রিকোণমিতিক ফাংশন ও সমীকরণ",
					},
					{ en: "Statics", bn: "স্থিতিবিদ্যা" },
					{ en: "Motion in a plane", bn: "সমতলে বস্তুকণার গতি" },
					{ en: "Dispersion and probability", bn: "বিস্তার পরিমাপ ও সম্ভাবনা" },
				],
			},
		],
	},
	{
		id: "bio",
		en: "Biology",
		bn: "জীববিজ্ঞান",
		books: [
			{
				id: "bio1",
				en: "Biology 1st paper",
				bn: "জীববিজ্ঞান ১ম পত্র",
				chapters: [
					{ en: "Cell and its structure", bn: "কোষ ও এর গঠন" },
					{ en: "Cell division", bn: "কোষ বিভাজন" },
					{ en: "Cell chemistry", bn: "কোষ রসায়ন" },
					{ en: "Microorganisms", bn: "অণুজীব" },
					{ en: "Algae and fungi", bn: "শৈবাল ও ছত্রাক" },
					{ en: "Bryophytes and pteridophytes", bn: "ব্রায়োফাইটা ও টেরিডোফাইটা" },
					{
						en: "Gymnosperms and angiosperms",
						bn: "নগ্নবীজী ও আবৃতবীজী উদ্ভিদ",
					},
					{ en: "Tissues and tissue systems", bn: "টিস্যু ও টিস্যুতন্ত্র" },
					{ en: "Plant physiology", bn: "উদ্ভিদ শারীরতত্ত্ব" },
					{ en: "Plant reproduction", bn: "উদ্ভিদ প্রজনন" },
					{ en: "Biotechnology", bn: "জীবপ্রযুক্তি" },
					{
						en: "Environment and conservation",
						bn: "জীবের পরিবেশ, বিস্তার ও সংরক্ষণ",
					},
				],
			},
			{
				id: "bio2",
				en: "Biology 2nd paper",
				bn: "জীববিজ্ঞান ২য় পত্র",
				chapters: [
					{ en: "Animal diversity", bn: "প্রাণীর বিভিন্নতা ও শ্রেণিবিন্যাস" },
					{ en: "Animal identity", bn: "প্রাণীর পরিচিতি" },
					{ en: "Digestion and absorption", bn: "পরিপাক ও শোষণ" },
					{ en: "Blood and circulation", bn: "রক্ত ও সঞ্চালন" },
					{ en: "Respiration", bn: "শ্বসন ও শ্বাসক্রিয়া" },
					{ en: "Excretion", bn: "বর্জ্য ও নিষ্কাশন" },
					{ en: "Locomotion", bn: "চলন ও অঙ্গচালনা" },
					{ en: "Coordination and control", bn: "সমন্বয় ও নিয়ন্ত্রণ" },
					{ en: "Continuity of human life", bn: "মানব জীবনের ধারাবাহিকতা" },
					{ en: "Body defence", bn: "মানবদেহের প্রতিরক্ষা" },
					{ en: "Genetics and evolution", bn: "জিনতত্ত্ব ও বিবর্তন" },
					{ en: "Animal behaviour", bn: "প্রাণীর আচরণ" },
				],
			},
		],
	},
	{
		id: "ict",
		en: "ICT",
		bn: "আইসিটি",
		books: [
			{
				id: "ict",
				en: "Information and Communication Technology",
				bn: "তথ্য ও যোগাযোগ প্রযুক্তি",
				chapters: [
					{
						en: "ICT in the world and Bangladesh",
						bn: "তথ্য ও যোগাযোগ প্রযুক্তি: বিশ্ব ও বাংলাদেশ প্রেক্ষিত",
					},
					{
						en: "Communication systems and networking",
						bn: "কমিউনিকেশন সিস্টেমস ও নেটওয়ার্কিং",
					},
					{
						en: "Number systems and digital devices",
						bn: "সংখ্যা পদ্ধতি ও ডিজিটাল ডিভাইস",
					},
					{ en: "Web design and HTML", bn: "ওয়েব ডিজাইন পরিচিতি ও HTML" },
					{ en: "Programming languages", bn: "প্রোগ্রামিং ভাষা" },
					{
						en: "Database management systems",
						bn: "ডেটাবেজ ম্যানেজমেন্ট সিস্টেম",
					},
				],
			},
		],
	},
];

export async function seedTaxonomy(db: ReturnType<typeof createDatabase>) {
	let subjectSort = 0;
	for (const subject of SUBJECTS) {
		await db
			.insert(subjects)
			.values({ id: subject.id, nameEn: subject.en, nameBn: subject.bn, sort: subjectSort++ })
			.onConflictDoUpdate({
				target: subjects.id,
				set: { nameEn: subject.en, nameBn: subject.bn },
			});

		let bookSort = 0;
		for (const book of subject.books) {
			await db
				.insert(books)
				.values({
					id: book.id,
					subjectId: subject.id,
					nameEn: book.en,
					nameBn: book.bn,
					sort: bookSort++,
				})
				.onConflictDoUpdate({
					target: books.id,
					set: { nameEn: book.en, nameBn: book.bn, subjectId: subject.id },
				});

			for (let i = 0; i < book.chapters.length; i++) {
				const chapter = book.chapters[i];
				await db
					.insert(chapters)
					.values({
						bookId: book.id,
						number: i + 1,
						nameEn: chapter.en,
						nameBn: chapter.bn,
					})
					.onConflictDoUpdate({
						target: [chapters.bookId, chapters.number],
						set: { nameEn: chapter.en, nameBn: chapter.bn },
					});
			}
		}
	}
}

// Allow `bun run src/db/seed/taxonomy.ts` directly, in addition to being
// imported and composed by a future combined seed entrypoint.
if (import.meta.main) {
	const db = createDatabase();
	await seedTaxonomy(db);
	console.log("Taxonomy seeded.");
	process.exit(0);
}
