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

// 로그인 API
app.post('/login', async (req, res) => {
  console.log(req.body);
  const { id, pwd } = req.body;  // 클라이언트에서 보낸 데이터

  if (!id || !pwd) {
    return res.status(400).send({ msg: '아이디와 비밀번호를 입력해주세요.' });
  }

  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `SELECT * FROM TBL_USER WHERE USERID = :id AND PASSWORD = :pwd`,
        [id, pwd], // :id, :pwd 바인딩 변수
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows.length > 0) {
        // 로그인 성공
        res.send({ msg: 'success', user: result.rows[0] });
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
  const {} = req.body;  // 클라이언트에서 보낸 데이터
  try {
    const connection = await connectToDB();
    if (connection) {
      const result = await connection.execute(
        `SELECT 
          BOARDNO, TITLE, USERNAME, CNT, TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') AS CDATETIME
          FROM BOARD B
          INNER JOIN MEMBER M ON B.USERID=M.USERID`,
          // ; 붙이지 않도록 주의 / TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') 같은 경우 별칭주기
        [], 
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      res.send({ msg: 'success', list : result.rows });
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
      res.send({ msg: 'success'});
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
  const {boardNo} = req.body;  // 클라이언트에서 보낸 데이터
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
          BOARDNO, TITLE, USERNAME, CONTENTS, CNT, TO_CHAR(B.CDATETIME, 'YYYY-MM-DD') AS CDATETIME
          FROM BOARD B
          INNER JOIN MEMBER M ON B.USERID=M.USERID
          WHERE BOARDNO = :boardNo`,
          // CONTENTS 와 WHERE BOARDNO = :boardNo 추가
        [boardNo], 
        // WHERE BOARDNO = :boardNo >> :boardNo =>> [boardNo],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      // res.send({ msg: 'success', list : result.rows });
      res.send({ msg: 'success', info : result.rows[0] });
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
      res.send({ msg: 'success'});
      await connection.close();
    } else {
      res.status(500).send({ msg: 'DB 연결 실패' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: '작성 중 오류가 발생했습니다.' });
  }
});

app.listen(3000, () => {
  console.log('서버가 3000 포트에서 실행 중입니다.');
});
