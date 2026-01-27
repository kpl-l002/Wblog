import React from 'react';
import { compile } from 'handlebars';

// 注册 formatDate 辅助函数
const registerHelpers = () => {
    if (!Handlebars.helpers.formatDate) {
        Handlebars.registerHelper('formatDate', (date) => {
            const d = new Date(date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
    }
};

class Article extends React.Component {
    constructor(props) {
        super(props);
        registerHelpers();
        this.template = `
            <div>
                <h1>{{siteName}}</h1>
                <h2><a href="#">{{title}}</a></h2>
                <p>{{formatDate date}}</p>
                {{#each tags}}
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