import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import md5 from 'md5';
import _ from 'lodash';

export default class Rollup extends Component {
  render() {
    if (location.hash) {
      return <Rollupping />;
    } else {
      return <NewGame />;
    }
  }
}

class NewGame extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <div>
      <button type='button' onClick={this.onCreate.bind(this)}>Create game</button>
    </div>;
  }

  onCreate() {
    location.href = `/#${randomString(16)}`;
    location.reload();
  }
}

class Rollupping extends Component {
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
              console.log(secretNumbers, _.map(this.state.submitedHashs, 'secretNumber'));
              const luckyHash = _.sortBy(secretNumbers).join();
              console.log('luckyHash', _.sortBy(secretNumbers).join());
              const luckyNumber = parseInt(luckyHash.slice(-8), 16);
              console.log('luckyNumber', parseInt(luckyHash.slice(-8), 16));

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

    return <div>
      My Name is <input value={this.state.name} onChange={this.onNameChange.bind(this)} />
      <button type='button' onClick={this.onSubmit.bind(this)} disabled={this.state.state !== 'initially'}>Submit Name</button>
      <button type='button' onClick={this.onConfirm.bind(this)} disabled={this.state.state !== 'submited'}>Confirm Ganmes</button>
      <div>
        Lucky Number: {this.state.luckyNumber}
      </div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Secret Number</th>
            <th>Salt(Confirmed)</th>
            <th>Hash</th>
            <th>Ranking</th>
          </tr>
        </thead>
        <tbody>
          {this.state.submitedHashs.map( submitedHash => {
            return <tr key={submitedHash.name}>
              <td>{submitedHash.name}</td>
              <td>{submitedHash.secretNumber}</td>
              <td>{submitedHash.salt}</td>
              <td>{submitedHash.hash}</td>
              <td>{this.state.luckyNumber && rankings.indexOf(submitedHash.secretNumber) + 1}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>;
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

ReactDOM.render(<Rollup />, document.getElementById('react-root'));
