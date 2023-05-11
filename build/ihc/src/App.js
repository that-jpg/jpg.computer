import React, { Component } from 'react';
import Button from '@material-ui/core/Button';
import Header from '@material-ui/core/Header';


class App extends Component {
  render() {
    return (
      <div className="App">
        <Header>
        </Header>
	<Button variant="contained" color="primary">
	      Hello World
	</Button>
      </div>
    );
  }
}

export default App;
