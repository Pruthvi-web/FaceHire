// src/components/CandidateDashboard.js

import React, { useState, useEffect, useRef } from "react";
import {
	Table,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Typography,
	Box,
	Divider,
	Grid,
	Paper,
	Stack,
	CssBaseline,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { firestore, auth } from "../firebase";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { format } from 'date-fns';

// System font stack
const systemFontStack = [
	"-apple-system",
	"BlinkMacSystemFont",
	'"Segoe UI"',
	"Roboto",
	"Oxygen",
	"Ubuntu",
	"Cantarell",
	'"Open Sans"',
	'"Helvetica Neue"',
	"sans-serif",
].join(", ");

// MUI theme overrides for Apple-style
const theme = createTheme({
	typography: {
		fontFamily: systemFontStack,
	},
	palette: {
		background: { default: "#fff" },
		primary: { main: "#0070f3" },
	},
	shape: {
		borderRadius: 8,
	},
	components: {
		MuiButton: {
			styleOverrides: {
				root: {
					borderRadius: 8,
					textTransform: "none",
				},
			},
		},
		MuiPaper: {
			styleOverrides: {
				root: {
					borderRadius: 8,
				},
			},
		},
		MuiDialog: {
			styleOverrides: {
				paper: {
					borderRadius: 8,
				},
			},
		},
		MuiTableCell: {
			styleOverrides: {
				root: {
					borderBottom: "1px solid #e1e1e4",
				},
			},
		},
	},
});

// Inline styles for custom elements
const styles = {
	container: {
		maxWidth: 800,
		margin: "40px auto",
		padding: "0 20px",
		background: "#fff",
	},
	title: {
		fontSize: 24,
		fontWeight: 600,
		color: "#1d1d1f",
		marginBottom: 24,
	},
	tabContainer: {
		display: "flex",
		gap: 12,
		marginBottom: 24,
	},
	tab: {
		flex: 1,
		padding: "10px 0",
		textAlign: "center",
		borderRadius: 8,
		backgroundColor: "#f5f5f7",
		cursor: "pointer",
		fontWeight: 500,
		border: "1px solid transparent",
	},
	activeTab: {
		backgroundColor: "#0070f3",
		color: "#fff",
		border: "1px solid #0070f3",
	},
	contentContainer: {
		padding: 20,
		border: "1px solid #e1e1e4",
		borderRadius: 8,
		background: "#fdfdfd",
		minHeight: 200,
	},
	input: {
		width: "100%",
		boxSizing: "border-box",
		padding: "12px 16px",
		fontSize: 16,
		border: "1px solid #d2d2d7",
		borderRadius: 8,
		background: "#f5f5f7",
		marginBottom: 20,
		outline: "none",
		fontFamily: systemFontStack,
	},
	button: {
		padding: "12px 20px",
		fontSize: 16,
		fontWeight: 600,
		backgroundColor: "#0070f3",
		color: "#fff",
		border: "none",
		borderRadius: 8,
		cursor: "pointer",
		fontFamily: systemFontStack,
	},
	card: {
		padding: 16,
		background: "#f5f5f7",
		borderRadius: 8,
		marginBottom: 16,
	},
	joinButton: {
		marginLeft: 12,
		padding: "6px 12px",
		fontSize: 14,
		fontWeight: 600,
		backgroundColor: "#0070f3",
		color: "#fff",
		border: "none",
		borderRadius: 6,
		cursor: "pointer",
	},
};

const convertTimestampToDate = (ts) => {
	if (!ts) return null;
	if (ts.seconds) return new Date(ts.seconds * 1000);
	return new Date(ts);
};

export default function CandidateDashboard() {
	const [candidateUid, setCandidateUid] = useState(null);
	const [candidateName, setCandidateName] = useState("");
	const [activeTab, setActiveTab] = useState("schedule");
	const [formData, setFormData] = useState({
		date: "",
		time: "",
		interviewer: "",
	});
	const [interviewers, setInterviewers] = useState([]);
	const [upcoming, setUpcoming] = useState([]);
	const [missed, setMissed] = useState([]);
	const [pastInterviews, setPastInterviews] = useState([]);
	const [loadingUpcoming, setLoadingUpcoming] = useState(true);
	const [loadingPast, setLoadingPast] = useState(true);
	const [modalOpen, setModalOpen] = useState(false);
	const [selectedInterview, setSelectedInterview] = useState(null);
	const reportRef = useRef();

	// Auth & user profile
	useEffect(() => {
		const unsub = auth.onAuthStateChanged((user) => {
			if (user) {
				setCandidateUid(user.uid);
				firestore
					.collection("users")
					.where("uid", "==", user.uid)
					.limit(1)
					.get()
					.then((snap) => {
						if (!snap.empty)
							setCandidateName(snap.docs[0].data().name || user.email);
						else setCandidateName(user.email);
					});
			}
		});
		return unsub;
	}, []);

	// Interviewers list (ensure “AI” exists)
	useEffect(() => {
		const unsub = firestore
			.collection("interviewers")
			.orderBy("name")
			.onSnapshot((snap) => {
				const list = snap.docs.map((d) => d.data().name);
				setInterviewers(list);
				if (!list.includes("AI")) {
					firestore
						.collection("interviewers")
						.add({ name: "AI", createdAt: new Date() });
				}
			});
		return unsub;
	}, []);

	// Default interviewer
	useEffect(() => {
		if (interviewers.includes("AI") && !formData.interviewer) {
			setFormData((fd) => ({ ...fd, interviewer: "AI" }));
		}
	}, [interviewers]);

	// Schedule Interview
	const scheduleInterview = async (e) => {
		e.preventDefault();
		if (!candidateUid) return toast.error("Log in again.");
		try {
			const scheduledAt = new Date(`${formData.date}T${formData.time}:00`);
			await firestore.collection("interviews").add({
				candidateUid,
				scheduledAt,
				interviewer: formData.interviewer,
				status: "upcoming",
				createdAt: new Date(),
			});
			toast.success("Interview scheduled!");
			setFormData({ date: "", time: "", interviewer: "" });
		} catch {
			toast.error("Could not schedule.");
		}
	};

	// Fetch upcoming/missed
	useEffect(() => {
		if (!candidateUid) return;
		const now = new Date();
		const unsub = firestore
			.collection("interviews")
			.where("candidateUid", "==", candidateUid)
			.where("status", "==", "upcoming")
			.orderBy("scheduledAt")
			.onSnapshot((snap) => {
				const fut = [],
					mis = [];
				snap.docs.forEach((doc) => {
					const d = doc.data();
					const date = convertTimestampToDate(d.scheduledAt);
					if (date >= now) fut.push({ id: doc.id, ...d });
					else mis.push({ id: doc.id, ...d });
				});
				setUpcoming(fut);
				setMissed(mis);
				setLoadingUpcoming(false);
			});
		return unsub;
	}, [candidateUid]);

	// Fetch past
	useEffect(() => {
		if (!candidateUid) return;
		const unsub = firestore
			.collection("interviews")
			.where("candidateUid", "==", candidateUid)
			.where("status", "==", "completed")
			.orderBy("scheduledAt", "desc")
			.onSnapshot((snap) => {
				setPastInterviews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
				setLoadingPast(false);
			});
		return unsub;
	}, [candidateUid]);

	// Open Report Modal
	const openReport = async (iv) => {
		const sessionSnap = await firestore
			.collection("interviewSessions")
			.where("interviewId", "==", iv.id)
			.limit(1)
			.get();
		let data = { ...iv, responses: [] };
		if (!sessionSnap.empty) data = { ...data, ...sessionSnap.docs[0].data() };
		setSelectedInterview(data);
		setModalOpen(true);
	};
	const closeReport = () => {
		setModalOpen(false);
		setSelectedInterview(null);
	};

	// PDF
	const downloadPDF = async () => {
		const canvas = await html2canvas(reportRef.current);
		const img = canvas.toDataURL("image/png");
		const pdf = new jsPDF("p", "pt", "a4");
		const w = pdf.internal.pageSize.getWidth();
		const h = (canvas.height * w) / canvas.width;
		pdf.addImage(img, "PNG", 0, 0, w, h);
		pdf.save(`report_${selectedInterview.id}.pdf`);
	};

	// Renderers
	const renderScheduleTab = () => (
		<form onSubmit={scheduleInterview}>
			<label>Date</label>
			<input
				type="date"
				style={styles.input}
				value={formData.date}
				onChange={(e) => setFormData((fd) => ({ ...fd, date: e.target.value }))}
				required
			/>
			<label>Time</label>
			<input
				type="time"
				style={styles.input}
				value={formData.time}
				onChange={(e) => setFormData((fd) => ({ ...fd, time: e.target.value }))}
				required
			/>
			<label>Interviewer</label>
			<select
				style={styles.input}
				value={formData.interviewer}
				onChange={(e) =>
					setFormData((fd) => ({ ...fd, interviewer: e.target.value }))
				}
				required
			>
				{interviewers.map((name) => (
					<option key={name} value={name}>
						{name}
					</option>
				))}
			</select>
			<button type="submit" style={styles.button}>
				Schedule Interview
			</button>
		</form>
	);

	const renderUpcomingTab = () => {
		if (loadingUpcoming) return <p>Loading...</p>;
		if (!upcoming.length && !missed.length)
			return <p>No interviews scheduled.</p>;
		return (
			<>
				{upcoming.length > 0 && (
					<Box mb={3}>
						<Typography variant="h6">Upcoming</Typography>
						{upcoming.map((iv) => {
							const d = convertTimestampToDate(iv.scheduledAt);
							return (
								<Box key={iv.id} style={styles.card}>
									<Typography>
                  {format(d, 'MMM d, yyyy')} at {format(d, 'h:mm a')} with{" "}
										<strong>{iv.interviewer}</strong>
									</Typography>
									<Link
										to={`/interview/${iv.id}`}
										style={{ textDecoration: "none" }}
									>
										<button style={styles.joinButton}>Join</button>
									</Link>
								</Box>
							);
						})}
					</Box>
				)}
				{missed.length > 0 && (
					<Box>
						<Typography variant="h6" color="textSecondary">
							Missed
						</Typography>
						{missed.map((iv) => {
							const d = convertTimestampToDate(iv.scheduledAt);
							return (
								<Box key={iv.id} style={styles.card}>
									<Typography color="textSecondary">
										{d.toLocaleDateString()} at {d.toLocaleTimeString()} with{" "}
										<strong>{iv.interviewer}</strong>
									</Typography>
								</Box>
							);
						})}
					</Box>
				)}
			</>
		);
	};

	const renderPastTab = () => {
		// pull responses array out of your selectedInterview
		const responses = selectedInterview?.responses || [];

		// build category summary
		const categoryMap = responses.reduce((acc, r) => {
			const cat = r.category || "Uncategorized";
			if (!acc[cat]) acc[cat] = { sum: 0, count: 0 };
			acc[cat].sum += r.score || 0;
			acc[cat].count += 1;
			return acc;
		}, {});

		// emotional analysis
		const totalAnxiety = responses.reduce(
			(sum, r) => sum + (r.emotion?.anxietyScore || 0),
			0
		);
		const avgAnxiety = responses.length ? totalAnxiety / responses.length : 0;
		const moodCounts = responses.reduce((acc, r) => {
			const m = r.emotion?.mood || "Unknown";
			acc[m] = (acc[m] || 0) + 1;
			return acc;
		}, {});

		return (
			<>
				{/* Past interviews table */}
				<Table>
					<TableHead>
						<TableRow>
							<TableCell>Date & Time</TableCell>
							<TableCell>Interviewer</TableCell>
							<TableCell>Action</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{pastInterviews.map((iv) => {
							const d = convertTimestampToDate(iv.scheduledAt);
							return (
								<TableRow key={iv.id}>
									<TableCell>{d?.toLocaleString()}</TableCell>
									<TableCell>{iv.interviewer}</TableCell>
									<TableCell>
										<Button onClick={() => openReport(iv)}>Show Report</Button>
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>

				{modalOpen && selectedInterview && (
					<Dialog
						open={modalOpen}
						onClose={closeReport}
						fullWidth
						maxWidth="md"
						BackdropProps={{
							sx: { backgroundColor: "rgba(0, 0, 0, 0.4)" },
						}}
						PaperProps={{
							sx: {
								m: 0,
								borderRadius: 2, // 8px
								boxShadow: "0 12px 60px rgba(0,0,0,0.2)",
								overflow: "hidden",
							},
						}}
					>
						{/* Wrap everything so you can control spacing & background */}
						<Box
							sx={{ bgcolor: "#fff", display: "flex", flexDirection: "column" }}
						>
							<DialogTitle
								sx={{
									fontFamily: systemFontStack,
									fontSize: "1.25rem",
									fontWeight: 600,
									borderBottom: "1px solid #e1e1e4",
									px: 4,
									py: 3,
								}}
							>
								Interview Assessment Report
								<IconButton
									onClick={closeReport}
									sx={{ position: "absolute", right: 16, top: 16 }}
								>
									<CloseIcon />
								</IconButton>
							</DialogTitle>

							<DialogContent
								ref={reportRef}
								dividers
								sx={{
									px: 4,
									py: 3,
									maxHeight: "70vh",
									overflowY: "auto",
									backgroundColor: "#f5f5f7",
								}}
							>
								{/* HEADER */}
								<Box
									sx={{
										display: "flex",
										flexWrap: "wrap",
										gap: 3,
										mb: 3,
									}}
								>
									{[
										["Candidate", candidateName],
										[
											"Date",
											convertTimestampToDate(
												selectedInterview.scheduledAt
											)?.toLocaleString(),
										],
										["Interviewer", selectedInterview.interviewer],
										[
											"Total Score",
											`${(
												(selectedInterview.responses || []).reduce(
													(s, r) => s + (r.score || 0),
													0
												) /
												Math.max((selectedInterview.responses || []).length, 1)
											).toFixed(1)}%`,
										],
									].map(([label, value]) => (
										<Box key={label} sx={{ minWidth: 140 }}>
											<Typography
												variant="subtitle2"
												sx={{ fontFamily: systemFontStack, color: "#3c3c4399" }}
											>
												{label}
											</Typography>
											<Typography
												variant="body1"
												sx={{ fontFamily: systemFontStack, fontWeight: 500 }}
											>
												{value}
											</Typography>
										</Box>
									))}
								</Box>

								{/* SECTION SUMMARIES */}
								{/* Category Summary */}
								<Box sx={{ mb: 4 }}>
									<Typography
										variant="h6"
										sx={{ fontFamily: systemFontStack, mb: 1 }}
									>
										Section Summary by Category
									</Typography>
									<Table size="small">
										<TableHead>
											<TableRow>
												<TableCell>Category</TableCell>
												<TableCell align="right">Avg Score</TableCell>
												<TableCell align="right">Count</TableCell>
											</TableRow>
										</TableHead>
										<TableBody>
											{Object.entries(categoryMap).map(
												([cat, { sum, count }]) => (
													<TableRow key={cat}>
														<TableCell sx={{ fontFamily: systemFontStack }}>
															{cat}
														</TableCell>
														<TableCell
															align="right"
															sx={{ fontFamily: systemFontStack }}
														>
															{(sum / count).toFixed(1)}%
														</TableCell>
														<TableCell
															align="right"
															sx={{ fontFamily: systemFontStack }}
														>
															{count}
														</TableCell>
													</TableRow>
												)
											)}
										</TableBody>
									</Table>
								</Box>

								{/* Emotional Analysis */}
								<Box sx={{ mb: 4 }}>
									<Typography
										variant="h6"
										sx={{ fontFamily: systemFontStack, mb: 1 }}
									>
										Emotional Analysis
									</Typography>
									<Grid container spacing={2}>
										<Grid item>
											<Typography sx={{ fontFamily: systemFontStack }}>
												<strong>Avg Anxiety Score:</strong>{" "}
												{avgAnxiety.toFixed(1)}
											</Typography>
										</Grid>
										{Object.entries(moodCounts).map(([mood, cnt]) => (
											<Grid item key={mood}>
												<Typography sx={{ fontFamily: systemFontStack }}>
													<strong>{mood}:</strong> {cnt}
												</Typography>
											</Grid>
										))}
									</Grid>
								</Box>

								<Divider sx={{ borderColor: "#e1e1e4", my: 4 }} />

								{/* Detailed Breakdown */}
								<Box>
									<Typography
										variant="h6"
										sx={{ fontFamily: systemFontStack, mb: 2 }}
									>
										Detailed Question Breakdown
									</Typography>
									<Stack spacing={3}>
										{responses.map((resp, i) => (
											<Paper
												key={i}
												sx={{
													p: 3,
													borderRadius: 2,
													bgcolor: "#fff",
													boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
												}}
											>
												<Grid container justifyContent="space-between">
													<Grid item xs={8}>
														<Typography
															variant="subtitle1"
															sx={{
																fontFamily: systemFontStack,
																fontWeight: 500,
																wordBreak: "break-word",
																whiteSpace: "pre-wrap",
															}}
														>
															{`Q${i + 1}. ${resp.question}`}
														</Typography>
													</Grid>
													<Grid item>
														<Typography
															variant="body2"
															sx={{ fontFamily: systemFontStack, mb: 1 }}
															align="right"
														>
															<strong>Score:</strong> {resp.score} / 100
														</Typography>
														<Typography
															variant="body2"
															sx={{ fontFamily: systemFontStack, mb: 1 }}
															align="right"
														>
															<strong>Emotion:</strong>{" "}
															{resp.emotion?.mood ?? "N/A"}
														</Typography>
														<Typography
															variant="body2"
															sx={{ fontFamily: systemFontStack, mb: 1 }}
															align="right"
														>
															<strong>Anxiety:</strong>{" "}
															{resp.emotion?.anxietyScore ?? 0}
														</Typography>
														<Typography
															variant="body2"
															sx={{ fontFamily: systemFontStack }}
															align="right"
															color="textSecondary"
														>
															{resp.difficulty}
														</Typography>
													</Grid>
												</Grid>
												<Box mt={2}>
													<Typography
														variant="body2"
														sx={{
															fontFamily: systemFontStack,
															whiteSpace: "pre-wrap",
														}}
													>
														<strong>Expected:</strong> {resp.correctAnswer}
													</Typography>
												</Box>
												<Box mt={1}>
													<Typography
														variant="body2"
														sx={{
															fontFamily: systemFontStack,
															whiteSpace: "pre-wrap",
														}}
													>
														<strong>Your Answer:</strong> {resp.answer}
													</Typography>
												</Box>
											</Paper>
										))}
									</Stack>
								</Box>
							</DialogContent>

							<DialogActions
								sx={{
									justifyContent: "flex-end",
									px: 4,
									py: 2,
									borderTop: "1px solid #e1e1e4",
									backgroundColor: "#fff",
								}}
							>
								<Button
									onClick={() => window.print()}
									sx={{ textTransform: "none" }}
								>
									Print
								</Button>
								<Button variant="contained" onClick={downloadPDF}>
									Download PDF
								</Button>
								<Button onClick={closeReport} sx={{ textTransform: "none" }}>
									Close
								</Button>
							</DialogActions>
						</Box>
					</Dialog>
				)}
			</>
		);
	};

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<div style={styles.container}>
				<h2 style={styles.title}>Candidate Dashboard</h2>
				<div style={styles.tabContainer}>
					{["schedule", "upcoming", "past"].map((tab) => (
						<div
							key={tab}
							onClick={() => setActiveTab(tab)}
							style={{
								...styles.tab,
								...(activeTab === tab ? styles.activeTab : {}),
							}}
						>
							{tab === "schedule"
								? "Schedule"
								: tab === "upcoming"
								? "Upcoming/Missed"
								: "Past / Reports"}
						</div>
					))}
				</div>
				<div style={styles.contentContainer}>
					{activeTab === "schedule" && renderScheduleTab()}
					{activeTab === "upcoming" && renderUpcomingTab()}
					{activeTab === "past" && renderPastTab()}
				</div>
			</div>
		</ThemeProvider>
	);
}
