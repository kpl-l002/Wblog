import React from 'react';
import { compile } from 'handlebars';

class Article extends React.Component {
    constructor(props) {
        super(props);
        this.template = `
            <div>
                <h1>{{siteName}}</h1>
                <h2><a href="#">{{this.title}}</a></h2>
                <p>{{formatDate this.date}}</p>
                {{#each this.tags}}
                    <span>{{this}}</span>
                {{/each}}
            </div>
        `;
        this.handlebarsTemplate = compile(this.template);
    }

    render() {
        const data = {
            siteName: "My Blog",
            title: "Sample Title",
            date: new Date(),
            tags: ["tag1", "tag2"]
        };
        const html = this.handlebarsTemplate(data);

        return (
            <div dangerouslySetInnerHTML={{ __html: html }} />
        );
    }
}

export default Article;