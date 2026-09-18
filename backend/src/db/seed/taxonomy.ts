import type { DB } from "..";
import { books, chapters, subjects, textbooks } from "../schema";

/**
 * The HSC taxonomy, from "HSC Subjects and Chapters (Bangladesh)" — the
 * syllabus document the product team maintains. Bengali names are the
 * document's, character for character (one exception, noted below); English
 * names are for the interface.
 *
 * Each subject has papers (`books` in the schema — see schema/taxonomy.ts),
 * each paper its chapters, and each subject the textbooks students use.
 * A textbook without `paper` covers both papers of its subject.
 *
 * Ids are stable: questions reference them, and re-running the seed
 * updates names in place.
 *
 * Names are stored in Unicode NFC. Bengali has two encodings for letters
 * like য় and ড় (one code point, or the base letter plus a nukta), the
 * document mixes both, and equal-looking names should compare equal.
 */

type Name = { en: string; bn: string };
type Paper = Name & { id: string; chapters: Name[] };
type Textbook = Name & { id: string; paper?: string };
type Subject = Name & { id: string; papers: Paper[]; textbooks: Textbook[] };

export const SUBJECTS: Subject[] = [
	{
		id: "phy",
		en: "Physics",
		bn: "পদার্থবিজ্ঞান",
		papers: [
			{
				id: "phy1",
				en: "Physics 1st paper",
				bn: "পদার্থবিজ্ঞান ১ম পত্র",
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
		],
		textbooks: [
			{
				id: "phy-amir-ishaq",
				en: "Dr. Amir Hossain Khan & Mohammad Ishaq",
				bn: "ড. আমির হোসেন খান ও মোহাম্মদ ইসহাক",
			},
			{
				id: "phy-tapan-aziz-rana",
				en: "Dr. Shahjahan Tapan, Muhammad Aziz Hasan & Dr. Rana Chowdhury",
				bn: "ড. শাহজাহান তপন, মুহাম্মদ আজিজ হাসান ও ড. রানা চৌধুরী",
			},
			{ id: "phy-gias", en: "Gias Uddin Ahmed", bn: "গিয়াস উদ্দিন আহমেদ" },
		],
	},
	{
		id: "chem",
		en: "Chemistry",
		bn: "রসায়ন",
		papers: [
			{
				id: "chem1",
				en: "Chemistry 1st paper",
				bn: "রসায়ন ১ম পত্র",
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
				chapters: [
					{ en: "Environmental chemistry", bn: "পরিবেশ রসায়ন" },
					{ en: "Organic chemistry", bn: "জৈব রসায়ন" },
					{ en: "Quantitative chemistry", bn: "পরিমাণগত রসায়ন" },
					{ en: "Electrochemistry", bn: "তড়িৎ রসায়ন" },
					{ en: "Economic chemistry", bn: "অর্থনৈতিক রসায়ন" },
				],
			},
		],
		textbooks: [
			{
				id: "chem-hazari-nag",
				en: "Saroj Kanti Singha Hazari & Haradhan Nag",
				bn: "সরোজ কান্তি সিংহ হাজারী ও হারাধন নাগ",
			},
			{ id: "chem-guha", en: "Sanjit Kumar Guha", bn: "সঞ্জিত কুমার গুহ" },
			{
				id: "chem-kabir-islam",
				en: "Dr. Gazi Md. Ahsanul Kabir & Dr. Md. Robiul Islam",
				bn: "ড. গাজী মো. আহসানুল কবীর ও ড. মো. রবিউল ইসলাম",
			},
		],
	},
	{
		id: "math",
		en: "Higher Math",
		bn: "উচ্চতর গণিত",
		papers: [
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
		],
		textbooks: [
			{
				id: "math-ahammed-jabbar",
				en: "S. U. Ahammed & M. A. Jabbar",
				bn: "এস. ইউ. আহাম্মেদ ও এম. এ. জব্বার",
			},
			{ id: "math-ketab", en: "Md. Ketab Uddin", bn: "মো. কেতাব উদ্দীন" },
			{ id: "math-afsar", en: "Afsar Uz-Zaman", bn: "আফসার উজ্জামান" },
		],
	},
	{
		id: "bio",
		en: "Biology",
		bn: "জীববিজ্ঞান",
		papers: [
			{
				id: "bio1",
				en: "Biology 1st paper (Botany)",
				bn: "জীববিজ্ঞান ১ম পত্র (উদ্ভিদবিজ্ঞান)",
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
					// The document has a Japanese katakana イ in place of the
					// Bengali ই here ("(イমিউনোলজি)"); seeded as intended.
					{
						en: "Defence of the human body (immunology)",
						bn: "মানবদেহের প্রতিরক্ষা (ইমিউনোলজি)",
					},
					{ en: "Genetics and evolution", bn: "জিনতত্ত্ব ও বিবর্তন" },
					{ en: "Animal behaviour", bn: "প্রাণীর আচরণ" },
				],
			},
		],
		textbooks: [
			{
				id: "bio1-abul-hasan",
				paper: "bio1",
				en: "Dr. Mohammad Abul Hasan",
				bn: "ড. মোহাম্মদ আবুল হাসান",
			},
			{ id: "bio1-alim", paper: "bio1", en: "Dr. Md. Abdul Alim", bn: "ড. মো. আব্দুল আলীম" },
			{
				id: "bio1-azim",
				paper: "bio1",
				en: "Prof. Dr. Md. Azim Uddin",
				bn: "অধ্যাপক ড. মো. আজিম উদ্দীন",
			},
			{
				id: "bio2-azmal-asmat",
				paper: "bio2",
				en: "Gazi Azmal & Gazi Asmat",
				bn: "গাজী আজমল ও গাজী আসমত",
			},
			{ id: "bio2-mazeda", paper: "bio2", en: "Prof. Mazeda Begum", bn: "অধ্যাপক মাজেদা বেগম" },
			{
				id: "bio2-altaf",
				paper: "bio2",
				en: "Prof. Dr. Md. Altaf Hossain",
				bn: "অধ্যাপক ড. মো. আলতাফ হোসেন",
			},
		],
	},
	{
		id: "ict",
		en: "ICT",
		bn: "তথ্য ও যোগাযোগ প্রযুক্তি",
		papers: [
			{
				id: "ict",
				en: "Information and Communication Technology",
				bn: "তথ্য ও যোগাযোগ প্রযুক্তি",
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
		],
		textbooks: [
			{ id: "ict-mujibur", en: "Engr. Mujibur Rahman", bn: "প্রকৌশলী মুজিবুর রহমান" },
			{ id: "ict-mahbubur", en: "Mahbubur Rahman", bn: "মাহবুবুর রহমান" },
			{
				id: "ict-prokash-mehedi",
				en: "Prokash Kumar Das & Engr. Mehedi Hasan",
				bn: "প্রকাশ কুমার দাস ও প্রকৌ. মেহেদী হাসান",
			},
		],
	},
];

const nfc = ({ en, bn }: Name) => ({ nameEn: en.normalize("NFC"), nameBn: bn.normalize("NFC") });

export async function seedTaxonomy(db: DB) {
	let subjectSort = 0;
	for (const subject of SUBJECTS) {
		await db
			.insert(subjects)
			.values({ id: subject.id, ...nfc(subject), sort: subjectSort++ })
			.onConflictDoUpdate({ target: subjects.id, set: nfc(subject) });

		let paperSort = 0;
		for (const paper of subject.papers) {
			await db
				.insert(books)
				.values({ id: paper.id, subjectId: subject.id, ...nfc(paper), sort: paperSort++ })
				.onConflictDoUpdate({
					target: books.id,
					set: { ...nfc(paper), subjectId: subject.id },
				});

			for (let i = 0; i < paper.chapters.length; i++) {
				const chapter = paper.chapters[i];
				await db
					.insert(chapters)
					.values({ bookId: paper.id, number: i + 1, ...nfc(chapter) })
					.onConflictDoUpdate({
						target: [chapters.bookId, chapters.number],
						set: nfc(chapter),
					});
			}
		}

		let textbookSort = 0;
		for (const textbook of subject.textbooks) {
			const values = {
				subjectId: subject.id,
				bookId: textbook.paper ?? null,
				...nfc(textbook),
				sort: textbookSort++,
			};
			await db
				.insert(textbooks)
				.values({ id: textbook.id, ...values })
				.onConflictDoUpdate({ target: textbooks.id, set: values });
		}
	}
}

// Run with `bun run db:seed` (-> `src/main.ts seed`). There is deliberately
// no `import.meta.main` block here: once bundled into dist/main.js,
// import.meta.main is true for the bundle, so such a block would seed the
// database and exit every time the server started.
