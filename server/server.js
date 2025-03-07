const express = require('express');
var cors = require('cors');
const oracledb = require('oracledb'); // Oracle DB 사용을 위한 패키지
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());

// ejs 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '.'));

// Oracle DB 연결 설정
const dbConfig = {
  user: 'system',
  password: 'test1234',
  connectString: 'localhost:1521/orcl'
};

async function connectToDB() {
  try {
    const connection = await oracledb.getConnection(dbConfig);
    console.log('Oracle DB 연결 성공!');
    return connection;
  } catch (err) {
    console.error('DB 연결 실패:', err);
    return null;
  }
}

// 기본 경로
app.get('/', function (req, res) {
  res.send('Hello World');
});

// package삭제하지 말 것
// cd server > 서버 폴더로 이동
// npm i로 node_modules 설치 (설치된 경우 스킵)
// nodemon server.js 로 서버 실행

// 로그인 API
app.post('/login', async (req, res) => {
  console.log(req.body);
  // const { id, pwd } = req.body;  // 클라이언트에서 보낸 데이터
  const { userId, pwd } = req.body;  // 클라이언트에서 보낸 데이터 
  // > userId로 받음

  if (!userId || !pwd) {
    // > userId로 수정
    return res.status(400).send({ msg: '아이디와 비밀번호를 입력해주세요.' });
  }

  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        // `SELECT * FROM MEMBER WHERE USERID = :userId AND PASSWORD = :pwd`,
        `SELECT USERNAME, NICKNAME FROM MEMBER WHERE USERID = :userId AND PASSWORD = :pwd`,
        [userId, pwd], // :id, :pwd 바인딩 변수
        // > userId로 수정
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length > 0) {
        // 로그인 성공
        res.send({ msg: 'success', user: result.rows[0] });
        // data로 전송
      } else {
        // 로그인 실패
        res.send({ msg: 'fail' });
      }

      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '로그인 중 오류가 발생했습니다.' });
  }
});

app.post('/list', async (req, res) => {
  // list 주소
  const {kind,keyword,orderKey,orderType,pageSize,page} = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      let search = ""; 
      if(kind == "all"){
        search = `WHERE TITLE LIKE '%${keyword}%' OR USERNAME LIKE '%${keyword}%'`;
      } else if(kind == "title") {
        search = `WHERE TITLE LIKE '%${keyword}%'`;
      } else {
        search = `WHERE USERNAME LIKE '%${keyword}%'`;
      };

      let order = "";

      if(orderKey!=""){
        order = ` ORDER BY ${orderKey} ${orderType}`;
      };
      // 페이징 작업을 위한 복사 시작점
      const result = await connection.execute(
        `SELECT B.BOARDNO, TITLE, USERNAME, B.USERID, CNT, TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') AS CDATETIME, NVL(BCCNT,0) AS BCCNT
        FROM BOARD B
        INNER JOIN MEMBER M ON B.USERID=M.USERID
        LEFT JOIN (
            SELECT COUNT(*) AS BCCNT, BOARDNO
            FROM BOARD_COMMENT
            GROUP BY BOARDNO
        ) T ON B.BOARDNO=T.BOARDNO ` + search + order 
          + ` OFFSET :page ROWS FETCH NEXT :pageSize ROWS ONLY`,
        // search가 문자열이기 때문에 join문 뒤에 띄어쓰기 해줘야함
        // ; 붙이지 않도록 주의 / TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') 같은 경우 별칭주기
        // [keyword], // %:keyword% >> %사이 값을 인식하지 못함.
        // '%' + keyword + '%' 형태가 되도록
        {pageSize,page},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      // 아래부터 페이징 작업
      const count = await connection.execute(
        `SELECT COUNT(*) AS BOARDCNT 
        FROM BOARD B
        INNER JOIN MEMBER M ON B.USERID=M.USERID`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.send({ msg: 'success', list: result.rows, count:count.rows[0].BOARDCNT });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '조회 중 오류가 발생했습니다.' });
  }
});

app.post('/remove', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { boardNo } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `DELETE FROM BOARD WHERE BOARDNO = :boardNo`,
        [boardNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '삭제 중 오류가 발생했습니다.' });
  }
});

app.post('/comment/remove', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { commentNo } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `DELETE FROM BOARD_COMMENT WHERE COMMENTNO = :commentNo`,
        [commentNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '삭제 중 오류가 발생했습니다.' });
  }
});

app.post('/view', async (req, res) => {
  // list 주소
  const { boardNo } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      //조회수 증가 필요. CONTENTS 조회 전 증가시켜줘야함
      await connection.execute(
        // 아래 const result = await connection.execute( 에서
        // await connection.execute() 함수 실행 부분 복사
        `UPDATE BOARD
        SET CNT = CNT+1
        WHERE BOARDNO = :boardNo`,
        // 조회수(CNT) 증가 쿼리 작성
        [boardNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      )
      //조회수 증가 완료. 커밋해줘야함.
      await connection.commit();
      // 커밋완료
      // 단점 >> 상세페이지에서 새로고침 시에도 조회수 증가
      // 아래부터 info 조회
      const result = await connection.execute(
        `SELECT 
        BOARDNO, TITLE, USERNAME, CONTENTS, CNT, TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') AS CDATETIME, TO_CHAR(B.UDATETIME, 'YYYY-MM-DD') AS UDATETIME
        FROM BOARD B
        INNER JOIN MEMBER M ON B.USERID=M.USERID
        WHERE BOARDNO = :boardNo`,
        // CONTENTS 와 WHERE BOARDNO = :boardNo 추가
        [boardNo],
        // WHERE BOARDNO = :boardNo >> :boardNo =>> [boardNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const comment = await connection.execute(
        `SELECT *
        FROM BOARD_COMMENT
        WHERE BOARDNO = :boardNo
        ORDER BY CDATETIME ASC`,
        [boardNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      // res.send({ msg: 'success', list : result.rows });
      res.send({ msg: 'success', info: result.rows[0], commentList:comment.rows });
      // 상세페이지에서는 boardNo 값 하나만 존재. list가 아니어도 됨.
      // rows[0] > 1개의 데이터
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '조회 중 오류가 발생했습니다.' });
  }
});

app.post('/board/info', async (req, res) => {
  // list 주소
  const { boardNo } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `SELECT 
          BOARDNO, TITLE, USERNAME, CONTENTS, CNT, TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') AS CDATETIME, TO_CHAR(B.UDATETIME, 'YYYY-MM-DD') AS UDATETIME
          FROM BOARD B
          INNER JOIN MEMBER M ON B.USERID=M.USERID
          WHERE BOARDNO = :boardNo`,
        [boardNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.send({ msg: 'success', info: result.rows[0] });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '조회 중 오류가 발생했습니다.' });
  }
});

app.post('/user/info', async (req, res) => {
  // list 주소
  const { userId } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        // `SELECT USERID, USERNAME, EMAIL, PHONE, DECODE(GENDER, 'M', '남자', 'F', '여자') AS GENDER
        // DECODE를 쓰지 않아도 user-view.html 에서 v-if로 변경가능함.
        // 1. DB에서 직접 표시 수정 / 2. html 안에서 직접 표시 수정
        `SELECT *
          FROM MEMBER
          WHERE USERID = :userId`,
        [userId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (result.rows.length > 0) {
        res.send({ msg: 'success', user: result.rows[0] });
        // data로 전송
      } else {
        res.send({ msg: 'fail' });
      }
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '조회 중 오류가 발생했습니다.' });
  }
});

app.post('/insert', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { title, contents, userId, kind } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `INSERT INTO BOARD
          VALUES (BOARD_SEQ.NEXTVAL, :title, :contents, :userId, :kind, 0,0,1, 'N', SYSDATE, SYSDATE)`,
        [title, contents, userId, kind],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '작성 중 오류가 발생했습니다.' });
  }
});

app.post('/comment/save', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { comment,boardNo } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `INSERT INTO BOARD_COMMENT 
          VALUES (COMMENT_SEQ.NEXTVAL, :boardNo, 'user01', :\"comment\", 1, SYSDATE, SYSDATE)`,
        [boardNo,comment],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '작성 중 오류가 발생했습니다.' });
  }
});

app.post('/edit', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { TITLE, CONTENTS, BOARDNO } = req.body;  // 클라이언트에서 보낸 데이터
  // self.info를 보냈기 때문에 대문자로 꺼내야 함
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `UPDATE BOARD
          SET
              TITLE = :TITLE,
              CONTENTS = :CONTENTS,
              UDATETIME = SYSDATE
          WHERE BOARDNO = :BOARDNO`,
        [TITLE, CONTENTS, BOARDNO],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '작성 중 오류가 발생했습니다.' });
  }
});

app.post('/user/edit', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { USERNAME,EMAIL,PHONE,GENDER,USERID } = req.body;  // 클라이언트에서 보낸 데이터
  // self.user를 보냈기 때문에 대문자로 꺼내야 함
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `UPDATE MEMBER
          SET
              USERNAME = :USERNAME,
              EMAIL = :EMAIL,
              PHONE = :PHONE,
              GENDER = :GENDER
          WHERE USERID = :USERID`,
        [USERNAME,EMAIL,PHONE,GENDER,USERID],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '작성 중 오류가 발생했습니다.' });
  }
});

app.post('/comment/update', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { COMMENTNO, CONTENTS } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `UPDATE BOARD_COMMENT
          SET
              CONTENTS = :CONTENTS,
              UDATETIME = SYSDATE
          WHERE COMMENTNO = :COMMENTNO`,
        [ CONTENTS, COMMENTNO],
        // 순서대로 적지 않으면 오류 발생
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '작성 중 오류가 발생했습니다.' });
  }
});

app.post('/prof/list', async (req, res) => {
  // list 주소
  const {} = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `SELECT PROFNO, NAME, POSITION, PAY, TO_CHAR(HIREDATE, 'YYYY-MM-DD') AS HIREDATE, DNAME
          FROM PROFESSOR P
          INNER JOIN DEPARTMENT D ON P.DEPTNO=D.DEPTNO`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.send({ msg: 'success', list: result.rows });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '조회 중 오류가 발생했습니다.' });
  }
});

app.post('/prof/remove', async (req, res) => {
  // pk값 필요
  console.log("req.body == > ", req.body);
  const { list } = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      let deleteTxt = "WHERE PROFNO IN (";
      // WHERE PROFNO IN ()
      for(let i=0; i<list.length; i++){
        deleteTxt += list[i]; 
        if(list.length-1 != i){
          deleteTxt += ",";
        }
      }
      deleteTxt += ")";0
      const result = await connection.execute(
        `DELETE FROM PROFESSOR ` + deleteTxt,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      await connection.commit();
      res.send({ msg: 'success' });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '삭제 중 오류가 발생했습니다.' });
  }
});

app.post('/emp/list', async (req, res) => {
  // list 주소
  const {} = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `SELECT SUM(SAL) AS SAL, DNAME
          FROM EMP E
          INNER JOIN DEPT D ON E.DEPTNO=D.DEPTNO
          GROUP BY DNAME`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.send({ msg: 'success', list: result.rows });
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '조회 중 오류가 발생했습니다.' });
  }
});

app.listen(3000, () => {
  console.log('서버가 3000 포트에서 실행 중입니다.');
});
