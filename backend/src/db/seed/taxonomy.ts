import { eq, inArray, notInArray } from "drizzle-orm";
import type { DB } from "..";
import { batches, books, chapters, levels, questions, subjects } from "../schema";

/**
 * The taxonomy, from "HSC Subjects and Chapters (Bangladesh)" — the
 * syllabus document the product team maintains:
 *
 *   level    a class             Class 11-12 (HSC)
 *   subject  a paper             Physics 1st paper
 *   book     an author's book    Dr. Shahjahan Tapan, … (for that paper)
 *   chapter  that book's chapter Newtonian mechanics
 *
 * Only the HSC level has a syllabus document so far. The other classes are
 * seeded empty so batches can already be put on them; their papers, books
 * and chapters go in LEVELS as the documents arrive.
 *
 * Every book of a paper has the paper's chapter list. Bengali names are the
 * document's (one typo fixed, noted below); English names are for the UI.
 *
 * Names are stored in Unicode NFC. Bengali has two encodings for letters
 * like য় and ড় (one code point, or the base letter plus a nukta), the
 * document mixes both, and equal-looking names should compare equal.
 */

type Name = { en: string; bn: string };
type Author = Name & { key: string };
type Paper = Name & { id: string; authors: Author[]; chapters: Name[] };
type Level = Name & { id: string; papers: Paper[] };

// Physics, Chemistry, Higher Math and ICT authors write both papers;
// Biology's are separate for Botany (1st) and Zoology (2nd).
const PHYSICS_AUTHORS: Author[] = [
	{
		key: "amir-ishaq",
		en: "Dr. Amir Hossain Khan & Mohammad Ishaq",
		bn: "ড. আমির হোসেন খান ও মোহাম্মদ ইসহাক",
	},
	{
		key: "tapan",
		en: "Dr. Shahjahan Tapan, Muhammad Aziz Hasan & Dr. Rana Chowdhury",
		bn: "ড. শাহজাহান তপন, মুহাম্মদ আজিজ হাসান ও ড. রানা চৌধুরী",
	},
	{ key: "gias", en: "Gias Uddin Ahmed", bn: "গিয়াস উদ্দিন আহমেদ" },
];

const CHEMISTRY_AUTHORS: Author[] = [
	{
		key: "hazari-nag",
		en: "Saroj Kanti Singha Hazari & Haradhan Nag",
		bn: "সরোজ কান্তি সিংহ হাজারী ও হারাধন নাগ",
	},
	{ key: "guha", en: "Sanjit Kumar Guha", bn: "সঞ্জিত কুমার গুহ" },
	{
		key: "kabir-islam",
		en: "Dr. Gazi Md. Ahsanul Kabir & Dr. Md. Robiul Islam",
		bn: "ড. গাজী মো. আহসানুল কবীর ও ড. মো. রবিউল ইসলাম",
	},
];

const MATH_AUTHORS: Author[] = [
	{
		key: "ahammed-jabbar",
		en: "S. U. Ahammed & M. A. Jabbar",
		bn: "এস. ইউ. আহাম্মেদ ও এম. এ. জব্বার",
	},
	{ key: "ketab", en: "Md. Ketab Uddin", bn: "মো. কেতাব উদ্দীন" },
	{ key: "afsar", en: "Afsar Uz-Zaman", bn: "আফসার উজ্জামান" },
];

const ICT_AUTHORS: Author[] = [
	{ key: "mujibur", en: "Engr. Mujibur Rahman", bn: "প্রকৌশলী মুজিবুর রহমান" },
	{ key: "mahbubur", en: "Mahbubur Rahman", bn: "মাহবুবুর রহমান" },
	{
		key: "prokash-mehedi",
		en: "Prokash Kumar Das & Engr. Mehedi Hasan",
		bn: "প্রকাশ কুমার দাস ও প্রকৌ. মেহেদী হাসান",
	},
];

const HSC_PAPERS: Paper[] = [
	{
		id: "phy1",
		en: "Physics 1st paper",
		bn: "পদার্থবিজ্ঞান ১ম পত্র",
		authors: PHYSICS_AUTHORS,
		chapters: [
			{ en: "Physical world and measurement", bn: "ভৌত জগত ও পরিমাপ" },
			{ en: "Vectors", bn: "ভেক্টর" },
			{ en: "Kinematics", bn: "গতিবিদ্যা" },
			{ en: "Newtonian mechanics", bn: "নিউটনিয়ান বলবিদ্যা" },
			{ en: "Work, energy and power", bn: "কাজ, শক্তি ও ক্ষমতা" },
			{ en: "Gravitation and gravity", bn: "মহাকর্ষ ও অভিকর্ষ" },
			{ en: "Structural properties of matter", bn: "পদার্থের গাঠনিক ধর্ম" },
			{ en: "Periodic motion", bn: "পর্যাবৃত্ত গতি" },
			{ en: "Waves", bn: "তরঙ্গ" },
			{
				en: "Ideal gas and the kinetic theory of gases",
				bn: "আদর্শ গ্যাস ও গ্যাসের গতিতত্ত্ব",
			},
		],
	},
	{
		id: "phy2",
		en: "Physics 2nd paper",
		bn: "পদার্থবিজ্ঞান ২য় পত্র",
		authors: PHYSICS_AUTHORS,
		chapters: [
			{ en: "Thermodynamics", bn: "তাপগতিবিদ্যা" },
			{ en: "Static electricity", bn: "স্থির তড়িৎ" },
			{ en: "Current electricity", bn: "চল তড়িৎ" },
			{
				en: "Magnetic effects of current and magnetism",
				bn: "তড়িৎ প্রবাহের চৌম্বক ক্রিয়া ও চুম্বকত্ব",
			},
			{
				en: "Electromagnetic induction and alternating current",
				bn: "তাড়িতচৌম্বক আবেশ ও পরিবর্তী প্রবাহ",
			},
			{ en: "Geometrical optics", bn: "জ্যামিতিক আলোকবিজ্ঞান" },
			{ en: "Physical optics", bn: "ভৌত আলোকবিজ্ঞান" },
			{ en: "Introduction to modern physics", bn: "আধুনিক পদার্থবিজ্ঞানের সূচনা" },
			{
				en: "Atomic models and nuclear physics",
				bn: "পরমাণুর মডেল এবং নিউক্লিয়ার পদার্থবিজ্ঞান",
			},
			{ en: "Semiconductors and electronics", bn: "সেমিকন্ডাক্টর ও ইলেকট্রনিক্স" },
			{ en: "Astronomy", bn: "জ্যোতির্বিজ্ঞান" },
		],
	},
	{
		id: "chem1",
		en: "Chemistry 1st paper",
		bn: "রসায়ন ১ম পত্র",
		authors: CHEMISTRY_AUTHORS,
		chapters: [
			{ en: "Safe use of the laboratory", bn: "ল্যাবরেটরির নিরাপদ ব্যবহার" },
			{ en: "Qualitative chemistry", bn: "গুণগত রসায়ন" },
			{
				en: "Periodic properties of elements and chemical bonding",
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
		authors: CHEMISTRY_AUTHORS,
		chapters: [
			{ en: "Environmental chemistry", bn: "পরিবেশ রসায়ন" },
			{ en: "Organic chemistry", bn: "জৈব রসায়ন" },
			{ en: "Quantitative chemistry", bn: "পরিমাণগত রসায়ন" },
			{ en: "Electrochemistry", bn: "তড়িৎ রসায়ন" },
			{ en: "Economic chemistry", bn: "অর্থনৈতিক রসায়ন" },
		],
	},
	{
		id: "math1",
		en: "Higher Math 1st paper",
		bn: "উচ্চতর গণিত ১ম পত্র",
		authors: MATH_AUTHORS,
		chapters: [
			{ en: "Matrices and determinants", bn: "ম্যাট্রিক্স ও নির্ণায়ক" },
			{ en: "Vectors", bn: "ভেক্টর" },
			{ en: "Straight lines", bn: "সরলরেখা" },
			{ en: "Circles", bn: "বৃত্ত" },
			{ en: "Permutations and combinations", bn: "বিন্যাস ও সমাবেশ" },
			{ en: "Trigonometric ratios", bn: "ত্রিকোণমিতিক অনুপাত" },
			{
				en: "Trigonometric ratios of associated angles",
				bn: "সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত",
			},
			{ en: "Functions and their graphs", bn: "ফাংশন ও ফাংশনের লেখচিত্র" },
			{ en: "Differentiation", bn: "অন্তরীকরণ" },
			{ en: "Integration", bn: "যোগজীকরণ" },
		],
	},
	{
		id: "math2",
		en: "Higher Math 2nd paper",
		bn: "উচ্চতর গণিত ২য় পত্র",
		authors: MATH_AUTHORS,
		chapters: [
			{ en: "Real numbers and inequalities", bn: "বাস্তব সংখ্যা ও অসমতা" },
			{ en: "Linear programming", bn: "যোগাশ্রয়ী প্রোগ্রামিং" },
			{ en: "Complex numbers", bn: "জটিল সংখ্যা" },
			{ en: "Polynomials and polynomial equations", bn: "বহুপদী ও বহুপদী সমীকরণ" },
			{ en: "Binomial expansion", bn: "দ্বিপদী বিস্তৃতি" },
			{ en: "Conics", bn: "কনিক" },
			{
				en: "Inverse trigonometric functions and trigonometric equations",
				bn: "বিপরীত ত্রিকোণমিতিক ফাংশন ও ত্রিকোণমিতিক সমীকরণ",
			},
			{ en: "Statics", bn: "স্থিতিবিদ্যা" },
			{ en: "Motion of a particle in a plane", bn: "সমতলে বস্তুকণার গতি" },
			{
				en: "Measures of dispersion and probability",
				bn: "বিস্তার পরিমাপ ও সম্ভাবনা",
			},
		],
	},
	{
		id: "bio1",
		en: "Biology 1st paper (Botany)",
		bn: "জীববিজ্ঞান ১ম পত্র (উদ্ভিদবিজ্ঞান)",
		authors: [
			{ key: "abul-hasan", en: "Dr. Mohammad Abul Hasan", bn: "ড. মোহাম্মদ আবুল হাসান" },
			{ key: "alim", en: "Dr. Md. Abdul Alim", bn: "ড. মো. আব্দুল আলীম" },
			{
				key: "azim",
				en: "Prof. Dr. Md. Azim Uddin",
				bn: "অধ্যাপক ড. মো. আজিম উদ্দীন",
			},
		],
		chapters: [
			{ en: "Cell and its structure", bn: "কোষ ও এর গঠন" },
			{ en: "Cell division", bn: "কোষ বিভাজন" },
			{ en: "Cell chemistry", bn: "কোষ রসায়ন" },
			{ en: "Microorganisms", bn: "অণুজীব" },
			{ en: "Algae and fungi", bn: "শৈবাল ও ছত্রাক" },
			{ en: "Bryophytes and pteridophytes", bn: "ব্রায়োফাইটা ও টেরিডোফাইটা" },
			{ en: "Gymnosperms and angiosperms", bn: "নগ্নবীজী ও আবৃতবীজী উদ্ভিদ" },
			{ en: "Tissues and tissue systems", bn: "টিস্যু ও টিস্যুতন্ত্র" },
			{ en: "Plant physiology", bn: "উদ্ভিদ শারীরতত্ত্ব" },
			{ en: "Plant reproduction", bn: "উদ্ভিদ প্রজনন" },
			{ en: "Biotechnology", bn: "জীবপ্রযুক্তি" },
			{
				en: "Environment, distribution and conservation of organisms",
				bn: "জীবের পরিবেশ, বিস্তার ও সংরক্ষণ",
			},
		],
	},
	{
		id: "bio2",
		en: "Biology 2nd paper (Zoology)",
		bn: "জীববিজ্ঞান ২য় পত্র (প্রাণিবিজ্ঞান)",
		authors: [
			{ key: "azmal-asmat", en: "Gazi Azmal & Gazi Asmat", bn: "গাজী আজমল ও গাজী আসমত" },
			{ key: "mazeda", en: "Prof. Mazeda Begum", bn: "অধ্যাপক মাজেদা বেগম" },
			{
				key: "altaf",
				en: "Prof. Dr. Md. Altaf Hossain",
				bn: "অধ্যাপক ড. মো. আলতাফ হোসেন",
			},
		],
		chapters: [
			{
				en: "Animal diversity and classification",
				bn: "প্রাণীর বিভিন্নতা ও শ্রেণিবিন্যাস",
			},
			{ en: "Introduction to animals", bn: "প্রাণীর পরিচিতি" },
			{
				en: "Human physiology: digestion and absorption",
				bn: "মানব শারীরতত্ত্ব: পরিপাক ও শোষণ",
			},
			{
				en: "Human physiology: blood and circulation",
				bn: "মানব শারীরতত্ত্ব: রক্ত ও সঞ্চালন",
			},
			{
				en: "Human physiology: breathing and respiration",
				bn: "মানব শারীরতত্ত্ব: শ্বাসক্রিয়া ও শ্বসন",
			},
			{
				en: "Human physiology: waste and excretion",
				bn: "মানব শারীরতত্ত্ব: বর্জ্য ও নিষ্কাশন",
			},
			{
				en: "Human physiology: locomotion and movement",
				bn: "মানব শারীরতত্ত্ব: চলন ও অঙ্গচালনা",
			},
			{
				en: "Human physiology: coordination and control",
				bn: "মানব শারীরতত্ত্ব: সমন্বয় ও নিয়ন্ত্রণ",
			},
			{ en: "Continuity of human life", bn: "মানব জীবনের ধারাবাহিকতা" },
			// The document has a Japanese katakana イ in place of the Bengali ই
			// here ("(イমিউনোলজি)"); seeded as intended.
			{
				en: "Defence of the human body (immunology)",
				bn: "মানবদেহের প্রতিরক্ষা (ইমিউনোলজি)",
			},
			{ en: "Genetics and evolution", bn: "জিনতত্ত্ব ও বিবর্তন" },
			{ en: "Animal behaviour", bn: "প্রাণীর আচরণ" },
		],
	},
	{
		id: "ict",
		en: "ICT",
		bn: "তথ্য ও যোগাযোগ প্রযুক্তি",
		authors: ICT_AUTHORS,
		chapters: [
			{
				en: "ICT: the world and Bangladesh perspective",
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
			{
				en: "Introduction to web design and HTML",
				bn: "ওয়েব ডিজাইন পরিচিতি এবং এইচটিএমএল",
			},
			{ en: "Programming languages", bn: "প্রোগ্রামিং ভাষা" },
			{ en: "Database management systems", bn: "ডেটাবেজ ম্যানেজমেন্ট সিস্টেম" },
		],
	},
];

/**
 * A student's batch decides which of these they see (batches.level_id), so
 * ids are stable: changing one strands every batch pointing at it.
 */
export const LEVELS: Level[] = [
	{ id: "class-5", en: "Class 5", bn: "পঞ্চম শ্রেণি", papers: [] },
	{ id: "class-8", en: "Class 8", bn: "অষ্টম শ্রেণি", papers: [] },
	{ id: "class-9-10", en: "Class 9–10 (SSC)", bn: "নবম-দশম শ্রেণি", papers: [] },
	{
		id: "class-11-12",
		en: "Class 11–12 (HSC)",
		bn: "একাদশ-দ্বাদশ শ্রেণি",
		papers: HSC_PAPERS,
	},
];

const nfc = ({ en, bn }: Name) => ({
	nameEn: en.normalize("NFC"),
	nameBn: bn.normalize("NFC"),
});

const bookId = (paper: Paper, author: Author) => `${paper.id}-${author.key}`;

/**
 * Upserts the taxonomy from the documents above.
 *
 * Staff also maintain the tree from the admin panel, so by default this
 * leaves rows it doesn't list alone — re-seeding must not delete a class
 * somebody added there. Pass `{ prune: true }` (`bun run db:seed --prune`)
 * to go back to "the documents are the whole truth" and drop the rest.
 * Idempotent, and all-or-nothing: it runs in one transaction.
 */
export async function seedTaxonomy(db: DB, { prune = false } = {}) {
	await db.transaction(async (tx) => {
		const db = tx as unknown as DB;
		const levelIds: string[] = [];
		const subjectIds: string[] = [];
		const bookIds: string[] = [];

		for (const [l, level] of LEVELS.entries()) {
			levelIds.push(level.id);
			await db
				.insert(levels)
				.values({ id: level.id, ...nfc(level), sort: l })
				.onConflictDoUpdate({ target: levels.id, set: { ...nfc(level), sort: l } });

			for (const [s, paper] of level.papers.entries()) {
				subjectIds.push(paper.id);
				await db
					.insert(subjects)
					.values({ id: paper.id, levelId: level.id, ...nfc(paper), sort: s })
					.onConflictDoUpdate({
						target: subjects.id,
						set: { levelId: level.id, ...nfc(paper), sort: s },
					});

				for (const [b, author] of paper.authors.entries()) {
					const id = bookId(paper, author);
					bookIds.push(id);
					await db
						.insert(books)
						.values({ id, subjectId: paper.id, ...nfc(author), sort: b })
						.onConflictDoUpdate({
							target: books.id,
							set: { subjectId: paper.id, ...nfc(author), sort: b },
						});

					for (const [c, chapter] of paper.chapters.entries()) {
						await db
							.insert(chapters)
							.values({ bookId: id, number: c + 1, ...nfc(chapter) })
							.onConflictDoUpdate({
								target: [chapters.bookId, chapters.number],
								set: nfc(chapter),
							});
					}
				}
			}
		}

		await adoptLegacyQuestions(db, bookIds);
		if (!prune) return;

		// batches.level_id has no foreign key (it lives in a better-auth
		// generated table), so dropping a level out from under a batch is
		// the one thing this seed has to check for itself.
		const stranded = await db
			.select({ id: batches.id, levelId: batches.levelId })
			.from(batches)
			.where(notInArray(batches.levelId, levelIds));
		if (stranded.length > 0) {
			const list = stranded.map((b) => `${b.id} (${b.levelId})`).join(", ");
			throw new Error(`These batches are on a level the seed no longer lists: ${list}`);
		}

		// Anything the documents no longer list. Questions were moved off
		// these rows above, so nothing references them any more.
		await db.delete(chapters).where(notInArray(chapters.bookId, bookIds));
		await db.delete(books).where(notInArray(books.id, bookIds));
		await db.delete(subjects).where(notInArray(subjects.id, subjectIds));
		await db.delete(levels).where(notInArray(levels.id, levelIds));
	});
}

/**
 * The previous taxonomy had papers as books under five broad subjects
 * (subject "phy" > book "phy1" > chapter n). A question filed that way
 * becomes subject "phy1" > that paper's first listed book > chapter n —
 * the paper and chapter are exact; the book is a best guess, since the
 * old shape never recorded one. Does nothing once no such question is left.
 */
async function adoptLegacyQuestions(db: DB, bookIds: string[]) {
	const legacy = await db
		.select({ id: questions.id, paperId: questions.bookId, number: chapters.number })
		.from(questions)
		.innerJoin(chapters, eq(chapters.id, questions.chapterId))
		.where(notInArray(questions.bookId, bookIds));
	if (legacy.length === 0) return;

	const paperIds = [...new Set(legacy.map((q) => q.paperId))];
	const targets = await db
		.select({
			paperId: books.subjectId,
			bookId: books.id,
			chapterId: chapters.id,
			number: chapters.number,
			sort: books.sort,
		})
		.from(books)
		.innerJoin(chapters, eq(chapters.bookId, books.id))
		.where(inArray(books.subjectId, paperIds));

	for (const q of legacy) {
		const target = targets
			.filter((t) => t.paperId === q.paperId && t.number === q.number)
			.sort((a, b) => a.sort - b.sort)[0];
		if (!target) {
			throw new Error(
				`Question ${q.id} is filed under ${q.paperId} chapter ${q.number}, which the taxonomy no longer has`,
			);
		}
		await db
			.update(questions)
			.set({ subjectId: target.paperId, bookId: target.bookId, chapterId: target.chapterId })
			.where(eq(questions.id, q.id));
	}
	console.log(`[seed] moved ${legacy.length} question(s) onto the new taxonomy`);
}

// Run with `bun run db:seed` (-> `src/main.ts seed`). There is deliberately
// no `import.meta.main` block here: once bundled into dist/main.js,
// import.meta.main is true for the bundle, so such a block would seed the
// database and exit every time the server started.
