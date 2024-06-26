const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const session = require("express-session"); // 세션 관리용 미들웨어
const fileStore = require("session-file-store")(session);
const mysql = require("mysql");
const path = require("path");
const multer = require("multer");
const moment = require("moment");
const fs = require("fs");
const sharedDiariesFile = path.join(__dirname, "sharedDiaries.json");

const port = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());

// Body-parser 미들웨어 설정
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // JSON 데이터 처리를 위한 설정
// 정적 파일 제공을 위한 public 디렉토리 설정
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "views")));

// 데이터베이스 연결 설정
const connection = mysql.createConnection({
    host: "203.234.62.118",
    user: "travel",
    password: "Qkfwkrnrxla123!",
    database: "travel",
    dataString: "date",
});

connection.connect((err) => {
    if (err) {
        return console.error("Error connecting to MySQL: " + err.message);
    }
    console.log("Connected to the MySQL server.");
});

// 공유된 일기 목록 불러오기
function loadSharedDiaries() {
    try {
        const data = fs.readFileSync(sharedDiariesFile, "utf8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            // 파일이 없을 경우, 빈 배열을 반환하고 파일을 생성합니다.
            console.log("sharedDiaries.json 파일이 없어서 새로 생성합니다.");
            saveSharedDiaries([]);
            return [];
        } else {
            console.error("Could not read shared diaries from file:", error);
            return []; // 파일을 읽을 수 없는 경우 빈 배열 반환
        }
    }
}

// 공유된 일기 목록 저장하기
function saveSharedDiaries(sharedDiaries) {
    try {
        fs.writeFileSync(
            sharedDiariesFile,
            JSON.stringify(sharedDiaries, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error("Could not save shared diaries to file:", error);
    }
}

// 서버 시작 시 공유된 일기 목록을 불러옵니다
let sharedDiaries = loadSharedDiaries();

// 세션 설정 (메모리 스토어 사용)
app.use(
    session({
        secret: "secret key", // 암호화하는 데 쓰일 키
        resave: false, // 세션을 언제나 저장할지 설정함
        saveUninitialized: true, // 세션이 저장되기 전 uninitialized 상태로 미리 만들어 저장
        cookie: {
            // 세션 쿠키 설정 (세션 관리 시 클라이언트에 보내는 쿠키)
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: false,
            secure: false,
        },
        store: new fileStore(),
    })
);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/"); // 파일이 저장될 서버의 경로
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname); // 파일 이름 설정
    },
});

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
    // 공유된 일기 ID가 저장된 배열을 사용
    const sql =
        "SELECT diary_id, user_id, photo_url FROM diary WHERE diary_id IN (?) ORDER BY created_at DESC LIMIT 10";
    connection.query(
        sql,
        [sharedDiaries.length > 0 ? sharedDiaries : [0]],
        (err, results) => {
            if (err) {
                console.error("Error fetching shared diaries: " + err.message);
                return res.status(500).send("Error fetching shared diaries");
            }
            res.render("main", {
                session: req.session,
                sharedDiaries: results,
            });
        }
    );
});

app.post("/retouch/:id", upload.single("profileImage"), async (req, res) => {
    const { username, password, email } = req.body;
    console.log(req.file.filename);
    const image = "/uploads/" + req.file.filename;
    const { id } = req.params;

    console.log("나 실행되고 있어..?");

    try {
        // users 배열의 첫 번째 요소를 user로 설정
        await connection.query(
            "SELECT * FROM users WHERE ID = ?",
            [id],
            (error, results) => {
                console.log(results.ID);
                if (error) {
                    console.log(error);
                }
                if (results.length === 0) {
                    return res.alert("유저를 찾을 수 없습니다.");
                }

                if (req.file) {
                    //기존 이미지를 파일 경로
                    const existingImagePath = results.image;
                    //기존 이미지가 있으면 삭제
                    if (existingImagePath) {
                        fs.unlinkSync(existingImagePath);
                    }
                }
            }
        );

        const updateQuery = `
            UPDATE users
            SET image = ?, USERNAME = ?, PASSWORD = ?, EMAIL = ?
            WHERE ID = ?
        `;
        // console.log(image, username, password, email, id);
        const updateValues = [image, username, password, email, id];

        // 업데이트 쿼리 실행
        await connection.query(updateQuery, updateValues);

        req.session.username = username;
        req.session.userimage = image;

        //diary-list 이동
        req.session.save((err) => {
            if (err) {
                console.error("Error saving session: " + err.message);
                return res.status(500).send("Error saving session");
            }
            //diary-list 이동
            res.redirect("/diary-list");
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Something went wrong" });
    }
});

//유저정보 수정
app.get("/retouch/:id", (req, res) => {
    res.render("retouch", { session: req.session });
});

// 이미지 업로드 및 데이터베이스 저장 라우트
app.post(
    "/upload-profile",
    upload.single("profileImage"),
    function (req, res, next) {
        const filePath = "/uploads/" + req.file.filename; // 데이터베이스에 저장할 경로

        // 여기서 필요한 데이터베이스 작업을 수행하세요
        const sql = "UPDATE INTO users (profileImagePath) VALUES (?)";
        connection.query(sql, [filePath], function (error, results, fields) {
            if (error) throw error;
            res.send("File uploaded and saved in database successfully");
        });
    }
);

// 회원가입 페이지 제공
app.get("/signup", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "signup.html"));
});

//마이페이지 페이지 제공
app.get("/mypage", (req, res) => {
    res.render("mypage", { session: req.session });
});

// 폼 데이터를 받아 MySQL 데이터베이스에 저장
app.post("/signup", (req, res) => {
    const data = {
        ID: req.body.id,
        USERNAME: req.body.username,
        PASSWORD: req.body.password,
        EMAIL: req.body.email,
    };

    // 먼저 ID가 이미 존재하는지 확인
    connection.query(
        "SELECT * FROM users WHERE ID = ?",
        [data.ID],
        (err, results) => {
            if (err) {
                return res
                    .status(500)
                    .send(
                        "사용자 ID를 확인하는 도중 오류 발생: " + err.message
                    );
            }
            if (results.length > 0) {
                return res
                    .status(400)
                    .send("이미 존재하는 ID입니다. 다른 ID를 선택해 주세요.");
            } else {
                // ID가 존재하지 않으면 새 사용자 삽입
                const sql =
                    "INSERT INTO users (ID, USERNAME, PASSWORD, EMAIL) VALUES (?, ?, ?, ?)";
                connection.query(
                    sql,
                    [data.ID, data.USERNAME, data.PASSWORD, data.EMAIL],
                    (error, results) => {
                        if (error) {
                            return res
                                .status(500)
                                .send(
                                    "회원가입 중 오류 발생: " + error.message
                                );
                        }
                        res.send("회원가입 완료!");
                    }
                );
            }
        }
    );
});

// 로그인 페이지 제공
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "login.html"));
});

// 로그인 처리
app.post("/login", (req, res) => {
    const { id, password } = req.body;

    if (id && password) {
        connection.query(
            "SELECT * FROM users WHERE ID = ? AND PASSWORD = ?",
            [id, password],
            (err, results) => {
                if (err) {
                    return res
                        .status(500)
                        .send("로그인 처리 중 오류 발생: " + err.message);
                }
                if (results.length > 0) {
                    req.session.is_logined = true; // 세션 정보 갱신
                    req.session.user_id = req.body.id;
                    req.session.username = results[0].USERNAME;
                    req.session.userimage = results[0].image;
                    req.session.save(function () {
                        console.log(req.session);
                        res.redirect(`/`);
                        // res.send("로그인 성공!");
                    });
                } else {
                    res.send(`<script type="text/javascript">alert("로그인 정보가 일치하지 않습니다."); 
                    document.location.href="/login";</script>`);
                }
            }
        );
    } else {
        res.send(`<script type="text/javascript">alert("아이디와 비밀번호를 입력하세요!"); 
        document.location.href="/login";</script>`);
    }
});

//로그아웃 페이지 제공
app.get("/logout", (req, res) => {
    req.session.destroy(function (err) {
        res.redirect("/");
    });
});

//다이어리 페이지 제공
app.get("/diary", (req, res) => {
    res.render("diary", { session: req.session });
});

//사진 업로드
app.post("/upload-diary", upload.single("photo"), (req, res) => {
    var today = new Date();
    const data = {
        user_id: req.session.user_id,
        title: req.body.title,
        content: req.body.content,
        photo_url: "/uploads/" + req.file.filename,
        created_at: moment(today).format("YYYY-MM-DD HH:mm:ss"),
    };
    console.log(data);
    const sql =
        "INSERT INTO diary (user_id, title, content, photo_url, created_at) VALUES (?, ?, ?, ?, ?)";
    connection.query(
        sql,
        [
            data.user_id,
            data.title,
            data.content,
            data.photo_url,
            data.created_at,
        ],
        (error, results) => {
            if (error) {
                return res
                    .status(500)
                    .send("업로드 중 오류 발생: " + error.message);
            }
            res.redirect("/diary-list");
        }
    );
});

// 초기 10개의 여행지 목록을 제공하는 경로 설정
app.get("/tour", (req, res) => {
    const sql = "SELECT id, subject, image FROM course LIMIT 10";
    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching courses: " + err.message);
            return res.status(500).send("Error fetching courses");
        }
        res.render("tour", { courses: results });
    });
});

// AJAX 요청을 통해 추가 여행지 목록을 제공하는 경로 설정
app.get("/api/more-courses", (req, res) => {
    const offset = parseInt(req.query.offset) || 0;
    const sql = "SELECT id, subject, image FROM course LIMIT 10 OFFSET ?";
    connection.query(sql, [offset], (err, results) => {
        if (err) {
            console.error("Error fetching more courses: " + err.message);
            return res.status(500).send("Error fetching more courses");
        }
        res.json(results);
    });
});

// 특정 여행지의 상세 정보를 제공하는 경로 설정
app.get("/tour/:id", (req, res) => {
    const tourId = req.params.id;
    const sql = "SELECT * FROM course WHERE id = ?";
    connection.query(sql, [tourId], (err, results) => {
        if (err) {
            console.error("Error fetching tour details: " + err.message);
            return res.status(500).send("Error fetching tour details");
        }
        if (results.length === 0) {
            return res.status(404).send("Tour not found");
        }
        res.render("tour-details", { course: results[0] });
    });
});

// 게시판 형태의 여행 정보 페이지 제공
app.get("/course", (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let offset = (page - 1) * 10;

    const sql =
        'SELECT num, POI_NM, CL_NM, CONCAT(CTPRVN_NM, " ", SIGNGU_NM) AS 지역 FROM tour LIMIT 10 OFFSET ?';
    connection.query(sql, [offset], (err, results) => {
        if (err) {
            console.error("Error fetching tour data: " + err.message);
            return res.status(500).send("Error fetching tour data");
        }

        // 전체 레코드 수를 가져와서 페이지 계산에 사용
        connection.query(
            "SELECT COUNT(*) AS count FROM tour",
            (countErr, countResults) => {
                if (countErr) {
                    console.error(
                        "Error fetching tour count: " + countErr.message
                    );
                    return res.status(500).send("Error fetching tour count");
                }

                let totalRecords = countResults[0].count;
                let totalPages = Math.ceil(totalRecords / 10);

                res.render("course", {
                    tours: results,
                    currentPage: page,
                    totalPages: totalPages,
                    session: req.session,
                });
            }
        );
    });
});

// 특정 게시물의 세부 정보를 가져오는 라우트
app.get("/course/:num", (req, res) => {
    const tourNum = req.params.num;
    const sql = "SELECT * FROM tour WHERE num = ?";
    connection.query(sql, [tourNum], (err, result) => {
        if (err) {
            console.error("Error fetching tour details: " + err.message);
            return res.status(500).send("Error fetching tour details");
        }
        if (result.length === 0) {
            return res.status(404).send("Tour not found");
        }
        res.render("course-details", { tour: result[0] });
    });
});

// 축제 정보 게시판 제공
app.get("/festival", (req, res) => {
    let page = parseInt(req.query.page) || 1;
    let offset = (page - 1) * 10;

    const sql =
        'SELECT ID, FCLTY_NM, CONCAT(CTPRVN_NM, " ", SIGNGU_NM) AS 지역, OPMTN_PLACE_NM, FSTVL_BEGIN_DE, FSTVL_END_DE FROM festival LIMIT 10 OFFSET ?';
    connection.query(sql, [offset], (err, results) => {
        if (err) {
            console.error("Error fetching festival data: " + err.message);
            return res.status(500).send("Error fetching festival data");
        }

        // 전체 레코드 수를 가져와서 페이지 계산에 사용
        connection.query(
            "SELECT COUNT(*) AS count FROM festival",
            (countErr, countResults) => {
                if (countErr) {
                    console.error(
                        "Error fetching festival count: " + countErr.message
                    );
                    return res
                        .status(500)
                        .send("Error fetching festival count");
                }

                let totalRecords = countResults[0].count;
                let totalPages = Math.ceil(totalRecords / 10);

                res.render("festival", {
                    festivals: results,
                    currentPage: page,
                    totalPages: totalPages,
                });
            }
        );
    });
});

// 특정 축제의 세부 정보를 가져오는 라우트
app.get("/festival/:id", (req, res) => {
    const festivalId = req.params.id;
    const sql = "SELECT * FROM festival WHERE ID = ?";
    connection.query(sql, [festivalId], (err, result) => {
        if (err) {
            console.error("Error fetching festival details: " + err.message);
            return res.status(500).send("Error fetching festival details");
        }
        if (result.length === 0) {
            return res.status(404).send("Festival not found");
        }
        res.render("festival-details", { festival: result[0] });
    });
});

app.get("/diary-list", (req, res) => {
    const sql = "SELECT diary_id, title, photo_url FROM diary where user_id =?";
    connection.query(sql, [req.session.user_id], (err, results) => {
        if (err) {
            console.error("Error fetching courses: " + err.message);
            return res.status(500).send("Error fetching courses");
        }
        res.render("diary-list", { list: results, session: req.session });
    });
});

app.get("/diary-details/:id", (req, res) => {
    const diaryId = req.params.id;
    const sql = "SELECT * FROM diary WHERE diary_id = ?";
    connection.query(sql, [diaryId], (err, results) => {
        if (err) {
            console.error("Error fetching tour details: " + err.message);
            return res.status(500).send("Error fetching tour details");
        }
        if (results.length === 0) {
            return res.status(404).send("diary_detail not found");
        }
        res.render("diary-details", { list: results[0] });
    });
});

//보람씨
app.delete("/comments/:commentId", async (req, res) => {
    const commentId = req.params.commentId;

    try {
        // 데이터베이스에서 댓글 삭제
        const deletedComment = await Comments.findByIdAndDelete(commentId);

        if (deletedComment) {
            res.status(200).json({
                success: true,
                message: "댓글이 성공적으로 삭제되었습니다.",
            });
        } else {
            res.status(404).json({
                success: false,
                message: "해당 ID의 댓글을 찾을 수 없습니다.",
            });
        }
    } catch (error) {
        console.error("댓글 삭제 중 오류:", error);
        res.status(500).json({
            success: false,
            message: "댓글 삭제 중 오류가 발생했습니다.",
        });
    }
});

app.get("/shared-diaries", (req, res) => {
    const sql = `SELECT diary_id, user_id, photo_url FROM diary ORDER BY created_at DESC LIMIT 10`;
    connection.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching shared diaries:", err);
            return res
                .status(500)
                .send("공유된 다이어리 가져오는 중 오류가 발생했습니다.");
        }
        res.json(results);
    });
});

app.post("/delete-diary", (req, res) => {
    const { diary_id } = req.body;
    const user_id = req.session.user_id; // 세션에서 사용자 ID 가져오기

    if (!diary_id) {
        return res.status(400).send("Diary ID is required.");
    }

    // 다이어리가 해당 사용자에게 속한지 확인
    const checkSql = "SELECT * FROM diary WHERE diary_id = ? AND user_id = ?";
    connection.query(checkSql, [diary_id, user_id], (err, results) => {
        if (err) {
            console.error("Error checking diary ownership: " + err.message);
            return res.status(500).send("Database error occurred.");
        }
        if (results.length === 0) {
            return res.status(403).send("Unauthorized to delete this diary.");
        }

        // 사용자가 다이어리의 소유자인 경우, 삭제 진행
        const deleteSql = "DELETE FROM diary WHERE diary_id = ?";
        connection.query(deleteSql, [diary_id], (err, result) => {
            if (err) {
                console.error("Error deleting diary: " + err.message);
                return res.status(500).send("Error deleting diary");
            }
            if (result.affectedRows === 0) {
                return res.status(404).send("Diary not found");
            }
            res.send("Diary has been successfully deleted.");
        });
    });
});

app.post("/share-diary", (req, res) => {
    const { diary_id } = req.body;
    const user_id = req.session.user_id; // 세션에서 사용자 ID 가져오기

    if (!diary_id) {
        return res.status(400).send("Diary ID is required.");
    }

    // 다이어리가 해당 사용자에게 속한지 확인
    const checkSql = "SELECT * FROM diary WHERE diary_id = ? AND user_id = ?";
    connection.query(checkSql, [diary_id, user_id], (err, results) => {
        if (err) {
            console.error("Error checking diary ownership: " + err.message);
            return res.status(500).send("Database error occurred.");
        }
        if (results.length === 0) {
            return res.status(403).send("Unauthorized to share this diary.");
        }

        // 사용자가 다이어리의 소유자인 경우, 공유 진행
        if (!sharedDiaries.includes(diary_id)) {
            sharedDiaries.push(diary_id);
            saveSharedDiaries(sharedDiaries);
        }
        res.status(200).send("Diary has been successfully shared!");
    });
});

let comments = {};

// 댓글 저장 함수
function saveComment(diaryId, userId, content) {
    if (!comments[diaryId]) {
        comments[diaryId] = [];
    }
    comments[diaryId].push({
        userId: userId,
        content: content,
        timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
    });
    saveCommentsToFile(); // 변경사항을 파일에 저장
}

// 댓글 불러오기 함수
function getComments(diaryId) {
    return comments[diaryId] || [];
}

// 서버 시작 시 댓글 파일을 불러옵니다
function loadCommentsFromFile() {
    try {
        const data = fs.readFileSync("comments.json", "utf8");
        comments = JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            // 파일이 없을 경우, 빈 객체로 초기화합니다.
            comments = {};
        } else {
            console.error("Could not read comments from file:", error);
        }
    }
}

// 댓글 파일 저장하기
function saveCommentsToFile() {
    try {
        fs.writeFileSync(
            "comments.json",
            JSON.stringify(comments, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error("Could not save comments to file:", error);
    }
}

// 서버 시작 시 댓글 파일을 불러옵니다
loadCommentsFromFile();

// 댓글 저장 엔드포인트
app.post("/submit-comment", (req, res) => {
    const { diary_id, content } = req.body;
    const userId = req.session.user_id; // 현재 세션에 저장된 사용자 아이디를 가져옴
    saveComment(diary_id, userId, content); // 댓글 저장
    res.json({ success: true });
});

// 댓글 불러오기 엔드포인트
app.get("/comments/:diaryId", (req, res) => {
    const diaryId = req.params.diaryId;
    const diaryComments = getComments(diaryId); // 해당 다이어리의 댓글 불러오기
    res.json(diaryComments);
});

// 오류 이벤트 핸들러 추가
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).send("Something went wrong!");
});

//카카오맵
app.get("/map", async (req, res) => {
    await res.render("map", { session: req.session });
});

// 보람

// 관심 리스트에 저장하는 라우트
app.post("/add-to-wishlist", (req, res) => {
    const { tour_id } = req.body;
    const user_id = req.session.user_id;

    console.log("Received tour_id:", tour_id);
    console.log("Session user_id:", user_id);

    if (!tour_id || !user_id) {
        console.error("Tour ID and user session are required.");
        return res.status(400).send({
            success: false,
            message: "Tour ID and user session are required.",
        });
    }

    const sql =
        "INSERT INTO user_favorites (user_id, tour_id, added_date) VALUES (?, ?, ?)";
    const added_date = moment().format("YYYYMMDD HH:mm:ss");

    connection.query(sql, [user_id, tour_id, added_date], (err, results) => {
        if (err) {
            console.error("Error adding to wishlist: " + err.message);
            return res
                .status(500)
                .send({ success: false, message: "Database error occurred." });
        }
        res.send({ success: true, message: "Successfully added to wishlist." });
    });
});

// 관심리스트에서 불러오기
app.get("/wishlist", (req, res) => {
    const userId = req.query.id;
    console.log("user_id:", userId); // 전달된 id 값 확인

    const sql = `
    SELECT * 
    FROM user_favorites
    WHERE user_id = ?
    ORDER BY added_date DESC;
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error("Error fetching wishlist: " + err.message);
            return res.status(500).send("Error fetching wishlist");
        }
        console.log("Results: ", results); // 쿼리 결과 확인
        res.render("wishlist", { wishlist: results });
    });
});

// 관심 리스트에서 삭제하는 라우트
app.post("/remove-from-wishlist", (req, res) => {
    const { favorite_id } = req.body;
    const user_id = req.session.user_id;

    const sql =
        "DELETE FROM user_favorites WHERE favorite_id = ? AND user_id = ?";
    connection.query(sql, [favorite_id, user_id], (err, results) => {
        if (err) {
            console.error("Error removing from wishlist: " + err.message);
            return res.status(500).send({
                success: false,
                message: "Error removing from wishlist",
            });
        }
        res.send({
            success: true,
            message: "Successfully removed from wishlist",
        });
    });
});
// 서버 실행
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

