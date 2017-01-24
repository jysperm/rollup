import React, {Component} from 'react';
import {Grid, Row, PageHeader, Button, Alert, FormGroup, ControlLabel, HelpBlock, FormControl} from 'react-bootstrap';
import {InputGroup, Col, Form, Table, Tooltip, OverlayTrigger, Label} from 'react-bootstrap';
import ReactDOM from 'react-dom';
import md5 from 'md5';
import _ from 'lodash';

export default class IndexView extends Component {
  render() {
    if (location.hash) {
      return <GameView />;
    } else {
      return <Grid>
        <Row>
          <PageHeader>
            Rollup <small>基于去中心化技术实现完全公平公开的抽奖游戏</small>
          </PageHeader>
        </Row>
        <Row>
          <Button onClick={this.onCreate.bind(this)} bsStyle='primary' bsSize='large'>创建抽奖</Button>
        </Row>
        <Row>
          <p>
            源代码和原理解释见 <a href='https://github.com/jysperm/rollup'>GitHub</a>
          </p>
        </Row>
      </Grid>;
    }
  }

  onCreate() {
    location.href = `/#${randomString(16)}`;
    location.reload();
  }
}

class GameView extends Component {
  constructor(props) {
    super(props);

    const [__, gameId] = location.hash.match(/#(\w+)/);

    this.state = {
      name: '',
      // initially, submited, confirmed, frozen, finished
      state: 'initially',
      gameId: gameId,
      submitedHashs: []
    }
  }

  componentDidMount() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(`${protocol}//${location.host}`);

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        event: 'joinGame',
        gameId: this.state.gameId
      }));
    });

    socket.addEventListener('message', ({data}) => {
      const message = JSON.parse(data);

      console.log('message', message);

      if (message.event === 'hashSubmited') {
        const exists = _.find(this.state.submitedHashs, {name: message.name});

        if (!_.includes(['initially', 'submited', 'confirmed'], this.state.state)) {
          return console.error(`confirm(${message.name}): already frozen`);
        }

        if (exists) {
          if (exists.hash !== message.hash) {
            console.error(`hashSubmited(${message.name}): hash mismatch`);
          }
        } else {
          this.setState({
            submitedHashs: this.state.submitedHashs.concat(message)
          });
        }
      } else if (message.event === 'confirmed') {
        const exists = _.find(this.state.submitedHashs, {name: message.name});

        if (!_.includes(['initially', 'submited', 'confirmed'], this.state.state)) {
          return console.error(`confirm(${message.name}): already frozen`);
        }

        if (exists) {
          if (exists.salt && exists.salt !== message.salt) {
            console.error(`confirm(${message.name}): salt mismatch`);
          } else {
            _.extend(exists, {salt: message.salt});

            this.setState({
              submitedHashs: this.state.submitedHashs
            });

            if (this.state.state === 'confirmed' && this.state.submitedHashs.every( submitHash => {
              return submitHash.salt;
            })) {
              this.socket.send(JSON.stringify({
                event: 'secretNumber',
                gameId: this.state.gameId,
                name: this.state.name,
                secretNumber: this.state.secretNumber
              }));

              this.setState({
                state: 'frozen'
              });
            }
          }
        } else {
          console.error(`confirm(${message.name}): ignored non exists`);
        }
      } else if (message.event === 'secretNumber') {
        const exists = _.find(this.state.submitedHashs, {name: message.name});

        if (exists) {
          if (exists.hash === md5(exists.salt + message.secretNumber.toString())) {
            _.extend(exists, {secretNumber: message.secretNumber});

            this.setState({
              submitedHashs: this.state.submitedHashs
            });

            if (this.state.submitedHashs.every( submitHash => {
              return submitHash.secretNumber;
            })) {
              const secretNumbers = _.map(this.state.submitedHashs, 'secretNumber');
              const luckyHash = _.sortBy(secretNumbers).join();
              const luckyNumber = parseInt(luckyHash.slice(-8), 16);

              console.log(`luckyNumber is ${luckyNumber}`);

              this.setState({
                state: 'finished',
                luckyNumber: luckyNumber
              });
            }
          } else {
            console.error(`secretNumber(${message.name}): hash mismatch`);
          }
        } else {
          console.error(`secretNumber(${message.name}): ignored non exists`);
        }
      } else if (message.event === 'newGamerJoined' && this.state.state !== 'initially') {
        this.socket.send(JSON.stringify({
          event: 'submitHash',
          gameId: this.state.gameId,
          name: this.state.name,
          hash: md5(this.state.salt + this.state.secretNumber.toString())
        }));
      }
    });
  }

  render() {
    const rankings = _.orderBy(_.map(this.state.submitedHashs, 'secretNumber'), secretNumber => {
      return Math.abs(secretNumber - this.state.luckyNumber);
    });

    return <Grid>
      <Row>
        <Alert bsStyle='success'>
          房间创建完成，请将当前网页的地址发给所有参与者进行抽奖。
        </Alert>
      </Row>
      <Row>
        <Form horizontal>
          <FormGroup>
            <Col componentClass={ControlLabel} sm={2}>
              我的名字
            </Col>
            <Col sm={10}>
              <InputGroup>
                <FormControl type='text' value={this.state.name} onChange={this.onNameChange.bind(this)} disabled={this.state.state !== 'initially'} />
                <InputGroup.Button>
                  <Button bsStyle='success' onClick={this.onSubmit.bind(this)} disabled={this.state.state !== 'initially'}>提交名字</Button>
                </InputGroup.Button>
              </InputGroup>
              <HelpBlock>这个名字将用于在游戏过程中唯一地标识你自己，请选用一个被所有参与者都熟知的名字。</HelpBlock>
            </Col>
          </FormGroup>
        </Form>
      </Row>
      <Row>
        <Table responsive>
          <thead>
            <tr>
              <th>名字</th>
              <th>选定的数字</th>
              <th>状态</th>
              <th>排名</th>
            </tr>
          </thead>
          <tbody>
            {this.state.submitedHashs.map( submitedHash => {
              const secretNumberTips = <Tooltip id={`secret-number-${submitedHash.name}`}>
                abs({submitedHash.secretNumber} - {this.state.luckyNumber}) = {Math.abs(submitedHash.secretNumber - this.state.luckyNumber)}
              </Tooltip>;

              const secretNumberText = <OverlayTrigger overlay={secretNumberTips} placement='top'>
                <a>{submitedHash.secretNumber}</a>
              </OverlayTrigger>;

              const statusTips = <Tooltip id={`status-${submitedHash.name}`}>
                salt: {submitedHash.salt || 'N/A'}
              </Tooltip>;

              const statusBlock = <OverlayTrigger overlay={statusTips} placement='top'>
                <Label bsStyle={submitedHash.salt ? 'success' : 'warning'}>
                  {submitedHash.salt ? '已确认' : '未确认'}
                </Label>
              </OverlayTrigger>;

              return <tr key={submitedHash.name}>
                <td>{submitedHash.name} (hash: {submitedHash.hash})</td>
                <td>{secretNumberText}</td>
                <td>{statusBlock}</td>
                <td>{this.state.luckyNumber && rankings.indexOf(submitedHash.secretNumber) + 1}</td>
              </tr>;
            })}
          </tbody>
        </Table>
      </Row>
      <Row>
        <Button bsStyle='warning' onClick={this.onConfirm.bind(this)} disabled={this.state.state !== 'submited'}>确认参与者</Button>
        <HelpBlock>请等待所有参与者都提交了名字，并确保没有人用不同的名字参与多次、没有不应参加的名字，然后再点击「确认参与者」。可开启开发人员工具查看日志，更多原理解释和源代码见 <a href='https://github.com/jysperm/rollup'>GitHub</a>。</HelpBlock>
      </Row>
    </Grid>;
  }

  onNameChange({target: {value}}) {
    this.setState({
      name: value
    });
  }

  onSubmit() {
    if (!this.state.name) {
      alert('Name can not be empty');
    }

    const secretNumber = randomNumber(0, Math.pow(2, 32));
    const salt = randomString(16);

    console.log(`My secretNumber is ${secretNumber}, salt is ${salt}`);

    this.socket.send(JSON.stringify({
      event: 'submitHash',
      gameId: this.state.gameId,
      name: this.state.name,
      hash: md5(salt + secretNumber.toString())
    }));

    this.setState({
      state: 'submited',
      secretNumber: secretNumber,
      salt: salt
    });
  }

  onConfirm() {
    this.socket.send(JSON.stringify({
      event: 'confirm',
      gameId: this.state.gameId,
      name: this.state.name,
      salt: this.state.salt
    }));

    this.setState({
      state: 'confirmed'
    });
  }
}

function randomString(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return result;
}

function randomNumber(min, max) {
  return Math.ceil(Math.random() * (max - min) + min);
}

ReactDOM.render(<IndexView />, document.getElementById('react-root'));
