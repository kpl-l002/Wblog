import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Article from './components/Article';

function App() {
    return (
        <Router>
            <Switch>
                <Route path="/article/:id" component={Article} />
            </Switch>
        </Router>
    );
}

export default App;